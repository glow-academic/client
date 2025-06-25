#!/usr/bin/env node

/**
 * Enhanced WebSocket Connection Debugging Script
 * Tests various connection scenarios and provides detailed diagnostics
 */

import { io } from "socket.io-client";

const PROFILE_ID = "965bd24f-dfae-4063-b370-e1373df46322";
const CLIENT_URL = "http://localhost:3000";
const SERVER_URL = "http://localhost:8000";

console.log("🔍 WebSocket Connection Diagnostics");
console.log("=====================================");

async function testDirectConnection() {
  console.log("\n1. Testing Direct Server Connection...");

  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      transports: ["polling", "websocket"],
      timeout: 10000,
      query: {
        profileId: PROFILE_ID,
        timestamp: Date.now(),
      },
    });

    const timeout = setTimeout(() => {
      console.log("❌ Direct connection timed out");
      socket.disconnect();
      resolve(false);
    }, 15000);

    socket.on("connect", () => {
      console.log("✅ Direct connection successful");
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Transport: ${socket.io.engine.transport.name}`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve(true);
    });

    socket.on("connection_confirmed", (data) => {
      console.log("✅ Server confirmation received:", data);
    });

    socket.on("connect_error", (error) => {
      console.log("❌ Direct connection error:", error.message);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function testProxyConnection() {
  console.log("\n2. Testing Proxy Connection...");

  return new Promise((resolve) => {
    const socket = io(CLIENT_URL, {
      path: "/api/ws/socket.io",
      transports: ["polling", "websocket"],
      timeout: 10000,
      forceNew: true,
      query: {
        profileId: PROFILE_ID,
        timestamp: Date.now(),
      },
    });

    const timeout = setTimeout(() => {
      console.log("❌ Proxy connection timed out");
      socket.disconnect();
      resolve(false);
    }, 15000);

    socket.on("connect", () => {
      console.log("✅ Proxy connection successful");
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Transport: ${socket.io.engine.transport.name}`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve(true);
    });

    socket.on("connection_confirmed", (data) => {
      console.log("✅ Server confirmation received:", data);
    });

    socket.on("connect_error", (error) => {
      console.log("❌ Proxy connection error:", error.message);
      console.log(
        "   Error details:",
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function testServerHealth() {
  console.log("\n3. Testing Server Health...");

  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log("✅ Server health check passed:", data);
    return true;
  } catch (error) {
    console.log("❌ Server health check failed:", error.message);
    return false;
  }
}

async function testProxyHealth() {
  console.log("\n4. Testing Proxy Health...");

  try {
    const response = await fetch(
      `${CLIENT_URL}/api/ws/socket.io/?EIO=4&transport=polling&t=${Date.now()}`
    );
    console.log(
      "✅ Proxy health check response:",
      response.status,
      response.statusText
    );
    return response.ok;
  } catch (error) {
    console.log("❌ Proxy health check failed:", error.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log(`Profile ID: ${PROFILE_ID}`);
  console.log(`Client URL: ${CLIENT_URL}`);
  console.log(`Server URL: ${SERVER_URL}`);

  const results = {
    serverHealth: await testServerHealth(),
    proxyHealth: await testProxyHealth(),
    directConnection: await testDirectConnection(),
    proxyConnection: await testProxyConnection(),
  };

  console.log("\n📊 Diagnostic Results:");
  console.log("======================");
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? "✅" : "❌"} ${test}: ${passed ? "PASS" : "FAIL"}`);
  });

  console.log("\n💡 Recommendations:");
  if (!results.serverHealth) {
    console.log("- Start the FastAPI server (cd server && make run)");
  }
  if (!results.proxyHealth) {
    console.log("- Check Next.js proxy configuration");
    console.log("- Verify the proxy route is accessible");
  }
  if (!results.directConnection) {
    console.log("- Check FastAPI Socket.IO configuration");
    console.log("- Verify CORS settings");
  }
  if (!results.proxyConnection) {
    console.log("- Check proxy path configuration");
    console.log("- Verify request forwarding logic");
  }

  const allPassed = Object.values(results).every(Boolean);
  console.log(
    `\n${allPassed ? "🎉" : "⚠️"} Overall Status: ${allPassed ? "ALL TESTS PASSED" : "ISSUES DETECTED"}`
  );
}

runDiagnostics().catch(console.error);
