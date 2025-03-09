const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map();

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    const { type, roomId, from, to, sdp, candidate } = data;

    if (type === "join") {
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(ws);
    } else {
      const room = rooms.get(roomId);
      if (room) {
        room.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ ...data, from: from || ws.id }));
          }
        });
      }
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
});

console.log("Signaling server running on ws://localhost:8080");