const https = require("https");
const WebSocket = require("ws");
const fs = require("fs");

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync("./src/localhost.pem"), 
  key: fs.readFileSync("./src/localhost-key.pem"), 
};

// Create HTTPS server
const port = process.env.PORT || 8080;
const server = https.createServer(sslOptions);

// Create WebSocket server over HTTPS
const wss = new WebSocket.Server({
  server,
  handleProtocols: (protocols, request) => {
    return protocols[0];
  },
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
});

const rooms = new Map();

wss.on("connection", (ws) => {
  console.log("New client connected", new Date().toISOString());

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { type, roomId, from, to, sdp, candidate } = data;

      console.log(`Received ${type} message:`, {
        type,
        roomId,
        from: from?.substring(0, 8),
        to: to?.substring(0, 8),
        hasSDP: !!sdp,
        hasCandidate: !!candidate,
      });

      if (type === "join") {
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
          console.log(`Created new room: ${roomId}`);
        }
        rooms.get(roomId).add(ws);
        console.log(`Client ${from?.substring(0, 8)} joined room: ${roomId}`);
        console.log(`Room ${roomId} has ${rooms.get(roomId).size} clients`);
      } else {
        const room = rooms.get(roomId);
        if (room) {
          let sentTo = 0;
          room.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ ...data, from: from || "unknown" }));
              sentTo++;
            }
          });
          console.log(`Message ${type} forwarded to ${sentTo} clients in room ${roomId}`);
        } else {
          console.log(`Room not found: ${roomId}`);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", () => {
    let roomLeft = null;
    rooms.forEach((clients, roomId) => {
      if (clients.has(ws)) {
        clients.delete(ws);
        roomLeft = roomId;
        console.log(`Client left room: ${roomId}, remaining clients: ${clients.size}`);
        if (clients.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted - no more clients`);
        }
      }
    });
    console.log(`Client disconnected from${roomLeft ? ` room ${roomLeft}` : " server"}`);
  });

  ws.on("error", (error) => console.error("WebSocket error:", error));
});

// Start the HTTPS server
server.listen(port, () => {
  console.log(`Signaling server running on port ${port} with WSS`);
  console.log(`Active rooms: ${rooms.size}`);
});

// Log room status every 30 seconds
setInterval(() => {
  console.log("\n=== Room Status ===");
  console.log(`Total rooms: ${rooms.size}`);
  rooms.forEach((clients, roomId) => {
    console.log(`Room ${roomId}: ${clients.size} clients`);
  });
}, 30000);