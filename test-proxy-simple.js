const { io } = require("socket.io-client");

console.log("Testing Socket.IO proxy connection...");

const proxySocket = io("http://localhost:3000", {
  path: "/api/ws/socket.io",
  transports: ["polling"],
  timeout: 15000,
  query: {
    profileId: "test-profile-id",
    timestamp: Date.now(),
  },
});

proxySocket.on("connect", () => {
  console.log("✅ Proxy connection successful!");
  console.log("Socket ID:", proxySocket.id);
  console.log("Transport:", proxySocket.io.engine.transport.name);
  proxySocket.disconnect();
  process.exit(0);
});

proxySocket.on("connect_error", (error) => {
  console.log("❌ Proxy connection failed:", error.message);
  console.log("Error type:", error.type);
  if (error.description) {
    console.log("Error description:", error.description);
  }
  process.exit(1);
});

// Timeout
setTimeout(() => {
  console.log("❌ Connection timeout");
  proxySocket.disconnect();
  process.exit(1);
}, 20000);
