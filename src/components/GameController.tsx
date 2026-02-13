import { useCallback, useRef, useState } from "react";
import { LaneTile } from "./LaneTile";
import { useRokuSocket } from "@/hooks/useRokuSocket";

// Lane to Roku remote key mapping
const LANE_TO_KEY: Record<number, string> = {
  0: "Left",
  1: "Up",
  2: "Down",
  3: "Right",
};

interface GameControllerProps {
  rokuIp: string;
  relayUrl: string;
  onOpenSetup: () => void;
}

export const GameController = ({
  rokuIp,
  relayUrl,
  onOpenSetup,
}: GameControllerProps) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Build the WebSocket URL from the relay address
  const wsUrl = relayUrl ? `ws://${relayUrl}` : "";

  // Stable callbacks
  const handleStatusChange = useCallback((s: string) => {
    console.log(`[RELAY] Status: ${s}`);
    if (s === "connected") setErrorMsg(null);
  }, []);

  const handleError = useCallback((msg: string) => {
    setErrorMsg(msg);
  }, []);

  // Connect to the relay server via WebSocket
  const { status, sendKey } = useRokuSocket({
    serverUrl: wsUrl,
    rokuIp,
    onStatusChange: handleStatusChange,
    onError: handleError,
  });

  // Track pending lanes for tap vs hold detection
  const pendingLanes = useRef<Record<number, boolean>>({});

  const handlePress = useCallback(
    (laneIndex: number) => {
      const key = LANE_TO_KEY[laneIndex];
      console.log(`[GAME] Lane ${laneIndex + 1} pressed (key: ${key})`);
      pendingLanes.current[laneIndex] = true;
      sendKey(key, "keydown");
    },
    [sendKey]
  );

  const handleRelease = useCallback(
    (laneIndex: number, wasLongPress: boolean) => {
      const key = LANE_TO_KEY[laneIndex];
      if (wasLongPress) {
        console.log(
          `[GAME] Lane ${laneIndex + 1} released - HOLD (key: ${key})`
        );
      } else {
        console.log(
          `[GAME] Lane ${laneIndex + 1} released - TAP (key: ${key})`
        );
      }
      sendKey(key, "keyup");
      delete pendingLanes.current[laneIndex];
    },
    [sendKey]
  );

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
          backgroundSize: "40px 40px",
        }}
      />

      {/* Settings button — returns to setup page */}
      <button
        onClick={onOpenSetup}
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
