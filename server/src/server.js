const https = require("https");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const os = require('os');

// Get local IP address to display in console
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // Fallback
};

const localIp = getLocalIpAddress();

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync("./src/localhost.pem"), 
  key: fs.readFileSync("./src/localhost-key.pem"), 
};

// Create both HTTP and HTTPS servers
const port = process.env.PORT || 8080;
const httpPort = process.env.HTTP_PORT || 8081;
const httpsServer = https.createServer(sslOptions);
const httpServer = http.createServer();

// Store connected clients by room
const rooms = new Map();

// Create WebSocket servers over both HTTP and HTTPS
const wssHttps = new WebSocket.Server({
  server: httpsServer,
  // Add these options for better cross-origin support
  perMessageDeflate: false,
  clientTracking: true,
});

const wssHttp = new WebSocket.Server({
  server: httpServer,
  perMessageDeflate: false,
  clientTracking: true,
});

// Function to handle WebSocket connections
const handleConnection = (ws) => {
  console.log("New client connected", new Date().toISOString());

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message type: ${data.type}`);

      // Handle different message types
      switch (data.type) {
        case "join":
          handleJoin(ws, data);
          break;
        case "offer":
        case "answer":
        case "candidate":
          forwardMessage(ws, data);
          break;
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    // Remove client from rooms
    for (const [roomId, clients] of rooms.entries()) {
      const index = clients.findIndex((client) => client.ws === ws);
      if (index !== -1) {
        const client = clients[index];
        clients.splice(index, 1);
        console.log(`Client ${client.id} removed from room ${roomId}`);
        
        // Notify other clients in the room
        clients.forEach((otherClient) => {
          otherClient.ws.send(JSON.stringify({
            type: "user-disconnected",
            userId: client.id,
          }));
        });
      }
    }
  });
};

// Handle join room requests
const handleJoin = (ws, data) => {
  const { roomId, from } = data;
  console.log(`Client ${from} joining room ${roomId}`);

  // Create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }

  // Add client to room
  const clients = rooms.get(roomId);
  clients.push({ id: from, ws });

  // Notify client of existing peers
  const existingPeers = clients
    .filter((client) => client.id !== from)
    .map((client) => client.id);

  ws.send(JSON.stringify({
    type: "room-joined",
    peers: existingPeers,
  }));

  console.log(`Client ${from} joined room ${roomId}. Existing peers: ${existingPeers.join(", ")}`);
};

// Forward messages to the intended recipient
const forwardMessage = (ws, data) => {
  const { to, roomId } = data;
  
  if (!roomId || !to) {
    console.log("Missing roomId or recipient in message");
    return;
  }

  const clients = rooms.get(roomId) || [];
  const recipient = clients.find((client) => client.id === to);

  if (recipient) {
    recipient.ws.send(JSON.stringify(data));
    console.log(`Message forwarded to ${to}`);
  } else {
    console.log(`Recipient ${to} not found in room ${roomId}`);
  }
};

// Apply the connection handler to both WebSocket servers
wssHttps.on("connection", handleConnection);
wssHttp.on("connection", handleConnection);

// Start the servers
httpsServer.listen(port, () => {
  console.log(`HTTPS WebSocket server running at:`);
  console.log(`- wss://localhost:${port}`);
  console.log(`- wss://${localIp}:${port}`);
});

httpServer.listen(httpPort, () => {
  console.log(`HTTP WebSocket server running at:`);
  console.log(`- ws://localhost:${httpPort}`);
  console.log(`- ws://${localIp}:${httpPort}`);
});

console.log("Signaling server started");