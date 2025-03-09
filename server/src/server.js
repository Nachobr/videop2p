const WebSocket = require("ws");

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });
const rooms = new Map();

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const { type, roomId, from, to, sdp, candidate } = data;

      if (type === "join") {
        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId).add(ws);
        console.log(`Client joined room: ${roomId}`);
      } else {
        const room = rooms.get(roomId);
        if (room) {
          room.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ ...data, from: from || "unknown" }));
            }
          });
        } else {
          console.log(`Room not found: ${roomId}`);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", () => {
    rooms.forEach((clients, roomId) => {
      if (clients.has(ws)) {
    clients.delete(ws);
    if (clients.size === 0) rooms.delete(roomId);
      }
    });
    console.log("Client disconnected");
  });

  ws.on("error", (error) => console.error("WebSocket error:", error));
});

console.log(`Signaling server running on port ${port}`);