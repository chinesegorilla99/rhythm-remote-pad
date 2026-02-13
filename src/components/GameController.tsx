import { useCallback, useEffect, useState } from "react";
import { LaneTile } from "./LaneTile";
import { useRokuSocket } from "@/hooks/useRokuSocket";

// Lane to Roku remote key mapping
const LANE_TO_KEY: Record<number, string> = {
  0: 'Left',
  1: 'Up',
  2: 'Down',
  3: 'Right'
};

export const GameController = () => {
  const [rokuIp, setRokuIp] = useState<string>(() => {
    return localStorage.getItem('rokuIp') || '';
  });
  const [relayUrl, setRelayUrl] = useState<string>(() => {
    return localStorage.getItem('relayUrl') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [inputIp, setInputIp] = useState(rokuIp);
  const [inputRelay, setInputRelay] = useState(relayUrl);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Build the WebSocket URL from the relay server address
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
  const handlePress = useCallback((laneIndex: number) => {
    const key = LANE_TO_KEY[laneIndex];
    console.log(`[GAME] Lane ${laneIndex + 1} pressed (key: ${key})`);
    sendKey(key, 'keydown');
  }, [sendKey]);

  const handleRelease = useCallback((laneIndex: number, wasLongPress: boolean) => {
    const key = LANE_TO_KEY[laneIndex];
    console.log(`[GAME] Lane ${laneIndex + 1} released - ${wasLongPress ? "HOLD" : "TAP"} (key: ${key})`);
    sendKey(key, 'keyup');
  }, [sendKey]);

  const handleSaveSettings = useCallback(() => {
    setRokuIp(inputIp);
    setRelayUrl(inputRelay);
    setRokuIpOnRelay(inputIp);
    setShowSettings(false);
    if (status !== "connected") reconnect();
  }, [inputIp, inputRelay, setRokuIpOnRelay, status, reconnect]);

  // Show settings if not configured
  if (!rokuIp || !relayUrl || showSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
        <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-foreground">🎮 Roku Setup</h2>
          <p className="text-muted-foreground mb-4">
            Enter your Roku IP and relay server address to connect.
          </p>

          {/* Relay Server Address */}
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Relay Server (your computer's IP:3002)
          </label>
          <input
            type="text"
            value={inputRelay}
            onChange={(e) => setInputRelay(e.target.value)}
            placeholder="192.168.1.50:3002"
            className="w-full p-3 border rounded-lg mb-4 bg-background text-foreground"
          />

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

          <div className="flex gap-2">
            <button
              onClick={handleSaveSettings}
              className="flex-1 bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold"
            >
              Connect
            </button>
            {rokuIp && relayUrl && (
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
