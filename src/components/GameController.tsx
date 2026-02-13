import { useCallback, useEffect, useRef, useState } from "react";
import { LaneTile } from "./LaneTile";
import { useRokuSocket } from "@/hooks/useRokuSocket";

// Lane to Roku remote key mapping
const LANE_TO_KEY: Record<number, string> = {
  0: 'Left',
  1: 'Up',
  2: 'Down',
  3: 'Right'
};

// Relay server always runs on port 3002.
// We auto-discover it by scanning the Roku's subnet.
const RELAY_PORT = 3002;

/**
 * Given a Roku IP like "192.168.7.236", try to find the relay server
 * on the same subnet by checking x.x.x.1 through x.x.x.254.
 * We try the most likely candidates first: same-last-octet neighbors.
 */
async function discoverRelay(rokuIp: string): Promise<string | null> {
  const parts = rokuIp.split(".");
  if (parts.length !== 4) return null;
  const subnet = parts.slice(0, 3).join(".");
  const rokuOctet = parseInt(parts[3], 10);

  // Build candidate list: nearby IPs first (±1, ±2, ...), then the rest
  const candidates: number[] = [];
  for (let offset = 1; offset <= 254; offset++) {
    for (const sign of [1, -1]) {
      const octet = rokuOctet + sign * offset;
      if (octet >= 1 && octet <= 254 && !candidates.includes(octet)) {
        candidates.push(octet);
      }
    }
  }

  // Race: try up to 10 at a time, first healthy response wins
  const batchSize = 20;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const result = await Promise.any(
      batch.map(async (octet) => {
        const ip = `${subnet}.${octet}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        try {
          const res = await fetch(`http://${ip}:${RELAY_PORT}/health`, {
            signal: controller.signal,
          });
          const data = await res.json();
          if (data.status === "ok") return `${ip}:${RELAY_PORT}`;
          throw new Error("not ok");
        } catch {
          throw new Error("unreachable");
        } finally {
          clearTimeout(timeout);
        }
      })
    ).catch(() => null);
    if (result) return result;
  }
  return null;
}

export const GameController = () => {
  const [rokuIp, setRokuIp] = useState<string>(() => {
    return localStorage.getItem('rokuIp') || '';
  });
  const [relayUrl, setRelayUrl] = useState<string>(() => {
    return localStorage.getItem('relayUrl') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [inputIp, setInputIp] = useState(rokuIp);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);

  // Build the WebSocket URL from the auto-discovered relay address
  const wsUrl = relayUrl ? `ws://${relayUrl}` : '';

  // Connect to the relay server via WebSocket
  const { status, sendKey, reconnect, setRokuIp: setRokuIpOnRelay } = useRokuSocket({
    serverUrl: wsUrl,
    rokuIp,
    onStatusChange: (s) => {
      console.log(`[RELAY] Status: ${s}`);
      if (s === "connected") setErrorMsg(null);
    },
    onError: (msg) => setErrorMsg(msg),
  });

  // Save settings to localStorage
  useEffect(() => {
    if (rokuIp) localStorage.setItem('rokuIp', rokuIp);
  }, [rokuIp]);

  useEffect(() => {
    if (relayUrl) localStorage.setItem('relayUrl', relayUrl);
  }, [relayUrl]);

  // ── Send keys through WebSocket relay (fire-and-forget) ─────────────
  // For taps: we send keydown on press, then decide on release.
  //   - TAP  → send keypress (single event, 50% less network chatter)
  //   - HOLD → send keydown on press + keyup on release
  // Track which lanes are pending so we know whether we already sent keydown.
  const pendingLanes = useRef<Record<number, boolean>>({});

  const handlePress = useCallback((laneIndex: number) => {
    const key = LANE_TO_KEY[laneIndex];
    console.log(`[GAME] Lane ${laneIndex + 1} pressed (key: ${key})`);
    // Mark as pending — we'll decide tap vs hold on release
    pendingLanes.current[laneIndex] = true;
    sendKey(key, 'keydown');
  }, [sendKey]);

  const handleRelease = useCallback((laneIndex: number, wasLongPress: boolean) => {
    const key = LANE_TO_KEY[laneIndex];
    if (wasLongPress) {
      // HOLD note: we already sent keydown on press, now send keyup
      console.log(`[GAME] Lane ${laneIndex + 1} released - HOLD (key: ${key}) → keyup`);
      sendKey(key, 'keyup');
    } else {
      // TAP note: send keyup to complete the keydown we already sent
      // The keydown→keyup pair is fast enough for Roku to treat as a press
      console.log(`[GAME] Lane ${laneIndex + 1} released - TAP (key: ${key}) → keyup`);
      sendKey(key, 'keyup');
    }
    delete pendingLanes.current[laneIndex];
  }, [sendKey]);

  const handleSaveSettings = useCallback(async () => {
    setRokuIp(inputIp);
    setRokuIpOnRelay(inputIp);
    setShowSettings(false);
    setErrorMsg(null);

    // Auto-discover the relay server on the same subnet
    setDiscovering(true);
    const found = await discoverRelay(inputIp);
    setDiscovering(false);

    if (found) {
      console.log(`🔍 Relay server found at ${found}`);
      setRelayUrl(found);
      if (status !== "connected") reconnect();
    } else {
      setErrorMsg("Could not find relay server on your network. Make sure it's running on your computer.");
    }
  }, [inputIp, setRokuIpOnRelay, status, reconnect]);

  // Show settings if not configured
  if (!rokuIp || showSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-foreground">🎮 Roku Setup</h2>
          <p className="text-muted-foreground mb-4">
            Enter your Roku device's IP address to connect the controller.
          </p>

          {/* Roku IP */}
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Roku IP Address
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Find it on your Roku: Settings → Network → About
          </p>
          <input
            type="text"
            value={inputIp}
            onChange={(e) => setInputIp(e.target.value)}
            placeholder="192.168.1.100"
            className="w-full p-3 border rounded-lg mb-4 bg-background text-foreground"
          />

          {/* Discovery status */}
          {discovering && (
            <p className="text-sm text-yellow-400 mb-4 animate-pulse">
              🔍 Searching for relay server on your network...
            </p>
          )}
          {errorMsg && !discovering && (
            <p className="text-sm text-red-400 mb-4">
              ❌ {errorMsg}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              disabled={discovering}
              className="flex-1 bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold disabled:opacity-50"
            >
              {discovering ? "Searching..." : "Connect"}
            </button>
            {rokuIp && (
              <button
                onClick={() => setShowSettings(false)}
                className="bg-secondary text-secondary-foreground py-3 px-4 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-2 sm:p-4">
      {/* Grid background effect */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(hsl(280 100% 60% / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(280 100% 60% / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-2 right-2 z-20 bg-secondary/50 text-secondary-foreground p-2 rounded-lg text-sm"
      >
        ⚙️
      </button>

      {/* Connection status */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            status === "connected"
              ? "bg-green-500"
              : status === "connecting"
              ? "bg-yellow-500 animate-pulse"
              : "bg-red-500"
          }`}
        />
        📺 {rokuIp}
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="absolute top-10 left-2 right-2 z-20 bg-red-500/20 border border-red-500/50 text-red-300 text-xs p-2 rounded font-mono">
          {errorMsg}
        </div>
      )}
      
      {/* Main controller container */}
      <div className="relative z-10 w-full h-full max-w-[100vw] max-h-[100vh] flex gap-2 sm:gap-4">
        {[0, 1, 2, 3].map((laneIndex) => (
          <LaneTile
            key={laneIndex}
            laneIndex={laneIndex}
            onPress={handlePress}
            onRelease={handleRelease}
          />
        ))}
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 font-mono">
        RHYTHM CONTROLLER • LANDSCAPE MODE
      </div>
    </div>
  );
};
