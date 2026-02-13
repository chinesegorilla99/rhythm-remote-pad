/**
 * useRokuSocket — WebSocket hook for the Roku relay server.
 *
 * Manages the WebSocket lifecycle:
 *  - Auto-connects on mount
 *  - Auto-reconnects on disconnect (with exponential backoff)
 *  - Provides a fire-and-forget `sendKey()` for minimal latency
 *  - Exposes connection state for UI feedback
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── TYPES ──────────────────────────────────────────────────────────────────
type ConnectionStatus = "connecting" | "connected" | "disconnected";
type EcpAction = "keydown" | "keyup" | "keypress";

interface UseRokuSocketOptions {
  /** The relay server URL, e.g. "ws://192.168.1.50:3002" */
  serverUrl: string;
  /** Roku IP to send to the relay on connect */
  rokuIp: string;
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Called when an error message comes from the server */
  onError?: (message: string) => void;
}

interface UseRokuSocketReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** Send a key action to the Roku via the relay. Fire-and-forget for speed. */
  sendKey: (key: string, action: EcpAction) => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Update the Roku IP on the relay server */
  setRokuIp: (ip: string) => void;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const INITIAL_RECONNECT_DELAY = 500;   // Start reconnect attempts at 500ms
const MAX_RECONNECT_DELAY = 5000;      // Cap at 5 seconds
const RECONNECT_BACKOFF = 1.5;         // Multiply delay by this each attempt

// ─── HOOK ───────────────────────────────────────────────────────────────────
export function useRokuSocket({
  serverUrl,
  rokuIp,
  onStatusChange,
  onError,
}: UseRokuSocketOptions): UseRokuSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef(false);
  const currentRokuIp = useRef(rokuIp);

  // Keep the ref in sync with the prop
  currentRokuIp.current = rokuIp;

  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // ── Connect to the relay server ────────────────────────────────────────
  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      intentionalClose.current = true;
      wsRef.current.close();
    }

    if (!serverUrl) return;

    updateStatus("connecting");
    intentionalClose.current = false;

    const ws = new WebSocket(serverUrl);

    ws.onopen = () => {
      console.log("🔌 WebSocket connected to relay server");
      updateStatus("connected");
      reconnectDelay.current = INITIAL_RECONNECT_DELAY; // Reset backoff

      // Tell the relay server which Roku to target
      if (currentRokuIp.current) {
        ws.send(
          JSON.stringify({
            type: "set-roku-ip",
            ip: currentRokuIp.current,
          })
        );
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "error") {
          console.warn("⚠️ Relay error:", msg.message);
          onError?.(msg.message);
        } else if (msg.type === "config") {
          console.log("📺 Relay config:", msg);
        }
      } catch {
        // Non-JSON message, ignore
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      updateStatus("disconnected");

      // Auto-reconnect unless we intentionally closed
      if (!intentionalClose.current) {
        console.log(
          `🔄 Reconnecting in ${reconnectDelay.current}ms...`
        );
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(
            reconnectDelay.current * RECONNECT_BACKOFF,
            MAX_RECONNECT_DELAY
          );
          connect();
        }, reconnectDelay.current);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      // onclose will fire after this, triggering reconnect
    };

    wsRef.current = ws;
  }, [serverUrl, updateStatus, onError]);

  // ── Send a key to the Roku via relay ───────────────────────────────────
  const sendKey = useCallback((key: string, action: EcpAction) => {
    const ws = wsRef.current;
    if (!ws) {
      console.warn("⚠️ [sendKey] WebSocket ref is null — not connected");
      return;
    }
    if (ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ [sendKey] WebSocket not OPEN (readyState=${ws.readyState}), dropping: ${action} ${key}`);
      return;
    }

    const payload = JSON.stringify({ action, key });
    console.log(`📤 [sendKey] Sending: ${payload}`);
    // Send as minimal JSON — no await, fire-and-forget for speed
    ws.send(payload);
  }, []);

  // ── Update Roku IP on the relay ────────────────────────────────────────
  const setRokuIpOnRelay = useCallback((ip: string) => {
    currentRokuIp.current = ip;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "set-roku-ip", ip }));
    }
  }, []);

  // ── Manual reconnect ──────────────────────────────────────────────────
  const reconnect = useCallback(() => {
    reconnectDelay.current = INITIAL_RECONNECT_DELAY;
    connect();
  }, [connect]);

  // ── Lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    connect();

    return () => {
      intentionalClose.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { status, sendKey, reconnect, setRokuIp: setRokuIpOnRelay };
}
