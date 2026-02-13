import { useCallback, useState } from "react";

const RELAY_PORT = 3002;

interface SetupPageProps {
  /** Pre-filled Roku IP from localStorage (may be empty) */
  initialIp: string;
  /** Called when the user successfully connects — transitions to the controller */
  onConnected: (rokuIp: string, relayUrl: string) => void;
}

/**
 * Scan the Roku's subnet for the relay server.
 * Tries nearby IPs first for speed.
 */
async function discoverRelay(rokuIp: string): Promise<string | null> {
  const parts = rokuIp.split(".");
  if (parts.length !== 4) return null;
  const subnet = parts.slice(0, 3).join(".");
  const rokuOctet = parseInt(parts[3], 10);

  const candidates: number[] = [];
  for (let offset = 1; offset <= 254; offset++) {
    for (const sign of [1, -1]) {
      const octet = rokuOctet + sign * offset;
      if (octet >= 1 && octet <= 254 && !candidates.includes(octet)) {
        candidates.push(octet);
      }
    }
  }

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

type Phase = "idle" | "discovering" | "success" | "error";

export const SetupPage = ({ initialIp, onConnected }: SetupPageProps) => {
  const [inputIp, setInputIp] = useState(initialIp);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [foundRelay, setFoundRelay] = useState("");

  const handleConnect = useCallback(async () => {
    const ip = inputIp.trim();
    if (!ip) return;

    // Basic IP format check
    const parts = ip.split(".");
    if (parts.length !== 4 || parts.some((p) => isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
      setPhase("error");
      setErrorMsg("Please enter a valid IP address (e.g. 192.168.1.100)");
      return;
    }

    setPhase("discovering");
    setErrorMsg("");

    const relay = await discoverRelay(ip);

    if (relay) {
      setFoundRelay(relay);
      setPhase("success");
      console.log(`🔍 Relay server found at ${relay}`);
      // Brief pause so the user sees the success animation
      setTimeout(() => onConnected(ip, relay), 800);
    } else {
      setPhase("error");
      setErrorMsg(
        "Could not find the relay server on your network. Make sure start-remote.sh is running on your computer."
      );
    }
  }, [inputIp, onConnected]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background p-6 overflow-hidden">
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(hsl(280 100% 60% / 0.4) 1px, transparent 1px),
            linear-gradient(90deg, hsl(280 100% 60% / 0.4) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Radial glow behind the card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[500px] h-[500px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(280 100% 60% / 0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Main Card ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎮</div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Rhythm Remote
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Phone controller for RokuBeat
          </p>
        </div>

        {/* Card body */}
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 shadow-2xl">
          {/* ── Idle / Error: Show input form ─── */}
          {(phase === "idle" || phase === "error") && (
            <>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Roku IP Address
              </label>
              <p className="text-xs text-muted-foreground/70 mb-3">
                Settings → Network → About on your Roku
              </p>
              <input
                type="text"
                inputMode="decimal"
                value={inputIp}
                onChange={(e) => {
                  setInputIp(e.target.value);
                  if (phase === "error") setPhase("idle");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="192.168.1.100"
                className="w-full p-3 border border-border rounded-xl bg-background text-foreground text-center text-lg tracking-widest placeholder:tracking-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                autoFocus
                autoComplete="off"
              />

              {phase === "error" && (
                <p className="text-sm text-red-400 mt-3 leading-snug">
                  {errorMsg}
                </p>
              )}

              <button
                onClick={handleConnect}
                disabled={!inputIp.trim()}
                className="w-full mt-5 py-3.5 rounded-xl font-semibold text-lg bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Connect
              </button>
            </>
          )}

          {/* ── Discovering: Scanning animation ─── */}
          {phase === "discovering" && (
            <div className="flex flex-col items-center py-6">
              {/* Spinning radar / pulse animation */}
              <div className="relative w-20 h-20 mb-5">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-primary/60 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                <div className="absolute inset-0 flex items-center justify-center text-2xl">
                  📡
                </div>
              </div>
              <p className="text-foreground font-medium">Searching for relay…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Scanning {inputIp.split(".").slice(0, 3).join(".")}.* on port {RELAY_PORT}
              </p>
            </div>
          )}

          {/* ── Success: Connected ─── */}
          {phase === "success" && (
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-5 setup-success-pop">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-foreground font-semibold text-lg">Connected!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Relay at {foundRelay}
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          Hold phone in landscape for best experience
        </p>
      </div>
    </div>
  );
};
