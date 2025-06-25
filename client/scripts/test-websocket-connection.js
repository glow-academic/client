#!/usr/bin/env node

import { io } from "socket.io-client";

// Test WebSocket connection
async function testWebSocketConnection() {
  console.log("🔌 Testing WebSocket connection via Next.js proxy...");

  // Test connection through Next.js proxy (same as client code)
  const socket = io("http://localhost:3000", {
    path: "/api/ws/socket.io",
    transports: ["polling"], // Start with polling only to test proxy
    autoConnect: true,
    forceNew: false,
    timeout: 15000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    upgrade: false, // Disable upgrade to test polling only
    query: {
      profileId: "test-profile-id",
      timestamp: Date.now(),
      EIO: "4",
    },
  });

  let connected = false;

  socket.on("connect", () => {
    connected = true;
    console.log("✅ WebSocket connected successfully!");
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Transport: ${socket.io.engine.transport.name}`);
    console.log(`   Connected: ${socket.connected}`);

    // Test a simple event that doesn't require database
    console.log("📤 Testing basic connectivity...");

    // Just test if the connection works by disconnecting after success
    setTimeout(() => {
      console.log("✅ Connection test successful!");
      socket.disconnect();
      process.exit(0);
    }, 1000);
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ WebSocket disconnected: ${reason}`);
    if (connected) {
      process.exit(0); // Expected disconnect
    }
  });

  socket.on("connect_error", (error) => {
    console.log(`❌ WebSocket connection error: ${error.message}`);
    console.log(`   Error details:`, error);
  });

  socket.on("error", (data) => {
    console.log("❌ Received error event:", data);
  });

  // Timeout after 15 seconds
  setTimeout(() => {
    console.log("⏰ Test timed out after 15 seconds");
    console.log(
      `   Connection state: ${socket.connected ? "connected" : "disconnected"}`
    );
    socket.disconnect();
    process.exit(1);
  }, 15000);
}

testWebSocketConnection().catch(console.error);
