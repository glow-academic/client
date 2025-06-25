#!/usr/bin/env node

const { io } = require("socket.io-client");

// Test WebSocket connection
async function testWebSocketConnection() {
  console.log("🔌 Testing WebSocket connection...");

  const socket = io("http://localhost:3000", {
    path: "/api/ws/socket.io",
    transports: ["polling", "websocket"],
    autoConnect: true,
    forceNew: true,
    timeout: 10000,
    query: {
      profileId: "test-profile-id",
      timestamp: Date.now(),
      EIO: "4",
    },
  });

  socket.on("connect", () => {
    console.log("✅ WebSocket connected successfully!");
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Transport: ${socket.io.engine.transport.name}`);

    // Test sending a start_simulation event
    console.log("📤 Testing start_simulation event...");
    socket.emit("start_simulation", {
      simulation_id: "test-simulation-id",
      profile_id: "test-profile-id",
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ WebSocket disconnected: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    console.log(`❌ WebSocket connection error: ${error.message}`);
  });

  socket.on("simulation_started", (data) => {
    console.log("✅ Received simulation_started event:", data);
    socket.disconnect();
    process.exit(0);
  });

  socket.on("error", (data) => {
    console.log("❌ Received error event:", data);
    socket.disconnect();
    process.exit(1);
  });

  // Timeout after 15 seconds
  setTimeout(() => {
    console.log("⏰ Test timed out after 15 seconds");
    socket.disconnect();
    process.exit(1);
  }, 15000);
}

testWebSocketConnection().catch(console.error);
