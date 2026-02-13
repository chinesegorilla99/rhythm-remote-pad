/**
 * Roku WebSocket Relay Server
 * 
 * Bridges the gap between the HTTPS-hosted companion app and the Roku's
 * HTTP-only ECP (External Control Protocol).
 * 
 * Flow:
 *   Phone (wss) → This Server (ws) → Roku (http POST :8060)
 * 
 * Message format from client:
 *   { "action": "keydown"|"keyup"|"keypress", "key": "Left"|"Right"|"Up"|"Down" }
 */

const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const { networkInterfaces } = require("os");

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const PORT = 3002;
const ROKU_IP = process.env.ROKU_IP || ""; // Set via env or entered by client
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// CORS — allow the Vercel-hosted app (and any origin) to reach our HTTP endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// Health check endpoint — the React app pings this to discover the relay
app.get("/health", (req, res) => {
  res.json({ status: "ok", rokuIp: activeRokuIp, uptime: process.uptime() });
});

// Allow the client to set the Roku IP at runtime
app.post("/set-roku-ip", (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: "Missing ip field" });
  activeRokuIp = ip;
  console.log(`📺 Roku IP set to: ${ip}`);
  res.json({ status: "ok", rokuIp: ip });
});

// Create HTTP server from Express so we can attach WebSocket to the same port
const server = http.createServer(app);

// ─── WEBSOCKET SERVER ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

// Track the active Roku IP (can be set via env, REST, or WebSocket)
let activeRokuIp = ROKU_IP;

// Valid ECP actions and keys
const VALID_ACTIONS = new Set(["keydown", "keyup", "keypress"]);
const VALID_KEYS = new Set([
  "Left", "Right", "Up", "Down",
  "Select", "Back", "Home", "Rev", "Fwd",
  "Play", "InstantReplay", "Info"
]);

/**
 * Send a key command to the Roku via ECP.
 * Uses raw http.request for minimal overhead (~2-5ms vs ~15ms with fetch).
 */
function sendToRoku(action, key) {
  return new Promise((resolve, reject) => {
    if (!activeRokuIp) {
      return reject(new Error("No Roku IP configured"));
    }

    const req = http.request(
      {
        hostname: activeRokuIp,
        port: 8060,
        path: `/${action}/${key}`,
        method: "POST",
        // No body needed for ECP key commands
        headers: { "Content-Length": 0 },
        // Aggressive timeout — fail fast for rhythm game responsiveness
        timeout: 500,
      },
      (res) => {
        res.resume(); // Drain the response
        resolve(res.statusCode);
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Roku request timed out"));
    });
    req.end();
  });
}

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🎮 Controller connected from ${clientIp}`);
  console.log(`   Active connections: ${wss.clients.size}`);

  // Send current config to the client
  ws.send(JSON.stringify({
    type: "config",
    rokuIp: activeRokuIp,
    serverTime: Date.now(),
  }));

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.warn("⚠️  Invalid JSON received:", raw.toString());
      return;
    }

    // Handle config messages (client setting the Roku IP)
    if (msg.type === "set-roku-ip" && msg.ip) {
      activeRokuIp = msg.ip;
      console.log(`📺 Roku IP updated via WebSocket: ${msg.ip}`);
      ws.send(JSON.stringify({ type: "config", rokuIp: msg.ip }));
      return;
    }

    // Handle key press messages
    const { action, key } = msg;

    if (!VALID_ACTIONS.has(action)) {
      console.warn(`⚠️  Invalid action: ${action}`);
      return;
    }
    if (!VALID_KEYS.has(key)) {
      console.warn(`⚠️  Invalid key: ${key}`);
      return;
    }

    try {
      const start = Date.now();
      await sendToRoku(action, key);
      const latency = Date.now() - start;
      console.log(`✅ ${action}/${key} → Roku (${latency}ms)`);
    } catch (err) {
      console.error(`❌ ${action}/${key} failed: ${err.message}`);
      ws.send(JSON.stringify({
        type: "error",
        message: `Roku unreachable: ${err.message}`,
      }));
    }
  });

  ws.on("close", () => {
    console.log(`👋 Controller disconnected (${wss.clients.size} remaining)`);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});

// ─── START SERVER ───────────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  const lanIp = getLanIp();
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║        🎵 Roku Rhythm Relay Server 🎵               ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Local:   http://localhost:${PORT}                    ║`);
  console.log(`║  Network: http://${lanIp}:${PORT}`.padEnd(55) + "║");
  console.log(`║  WebSocket: ws://${lanIp}:${PORT}`.padEnd(55) + "║");
  console.log("╠══════════════════════════════════════════════════════╣");
  if (activeRokuIp) {
    console.log(`║  Roku IP: ${activeRokuIp}`.padEnd(55) + "║");
  } else {
    console.log("║  Roku IP: (not set — will be sent by client)        ║");
  }
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Waiting for controller connections...");
  console.log("");
});

/**
 * Get the first non-internal IPv4 address (your LAN IP).
 */
function getLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}
