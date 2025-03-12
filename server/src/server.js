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

// Create WebSocket servers
const wssHttps = new WebSocket.Server({ server: httpsServer });
const wssHttp = new WebSocket.Server({ server: httpServer });

// Store connected clients by room
const rooms = new Map();

// Handle WebSocket connections
const handleConnection = (ws) => {
  console.log('Client connected');
  let clientId = null;
  let clientRoom = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      if (data.type === 'join') {
        clientId = data.from;
        clientRoom = data.roomId;
        
        // Create room if it doesn't exist
        if (!rooms.has(clientRoom)) {
          rooms.set(clientRoom, new Map());
        }
        
        // Add client to room
        const room = rooms.get(clientRoom);
        room.set(clientId, ws);
        
        console.log(`Client ${clientId} joined room ${clientRoom}`);
        console.log(`Room ${clientRoom} now has ${room.size} clients`);
        
        // Send the list of all users in the room to everyone
        const peers = Array.from(room.keys());
        const usersMessage = JSON.stringify({
          type: 'users',
          peers: peers,
          roomId: clientRoom
        });
        
        // Broadcast to all clients in the room
        room.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(usersMessage);
          }
        });
      } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
        // Forward the message to the specified recipient
        const room = rooms.get(data.roomId);
        if (room && room.has(data.to)) {
          const recipient = room.get(data.to);
          if (recipient.readyState === WebSocket.OPEN) {
            recipient.send(message.toString());
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // When a client disconnects
  ws.on('close', () => {
    console.log('Client disconnected');
    if (clientId && clientRoom && rooms.has(clientRoom)) {
      const room = rooms.get(clientRoom);
      room.delete(clientId);
      
      // If room is empty, delete it
      if (room.size === 0) {
        rooms.delete(clientRoom);
        console.log(`Room ${clientRoom} deleted (empty)`);
      } else {
        // Notify remaining clients about the disconnection
        const peers = Array.from(room.keys());
        const usersMessage = JSON.stringify({
          type: 'users',
          peers: peers,
          roomId: clientRoom
        });
        
        room.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(usersMessage);
          }
        });
      }
    }
  });
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