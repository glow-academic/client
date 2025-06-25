#!/usr/bin/env node

/**
 * WebRTC Debug Test Script
 * Tests WebRTC signaling and connection flow
 */

const WebSocket = require("ws");

const API_BASE = process.env.API_URL || "http://localhost:8000";
const CHAT_ID = process.env.CHAT_ID || "dd034172-0eb1-49c6-b9ba-9acd63def1b0";

console.log("🔧 WebRTC Debug Test Starting...");
console.log(`API Base: ${API_BASE}`);
console.log(`Chat ID: ${CHAT_ID}`);

async function testWebRTCFlow() {
  // Import fetch dynamically
  const { default: fetch } = await import("node-fetch");
  try {
    // Step 1: Test ICE server configuration
    console.log("\n1️⃣ Testing ICE server configuration...");
    const iceResponse = await fetch(`${API_BASE}/rtc/ice`);
    if (!iceResponse.ok) {
      throw new Error(`ICE request failed: ${iceResponse.statusText}`);
    }
    const iceConfig = await iceResponse.json();
    console.log("✅ ICE Config:", JSON.stringify(iceConfig, null, 2));

    // Step 2: Test WebSocket signaling connection
    console.log("\n2️⃣ Testing WebSocket signaling connection...");
    const signalingWs = new WebSocket(
      `${API_BASE.replace("http", "ws")}/rtc/signaling/${CHAT_ID}`
    );

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, 5000);

      signalingWs.on("open", () => {
        console.log("✅ WebSocket signaling connected");
        clearTimeout(timeout);
        resolve();
      });

      signalingWs.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
        clearTimeout(timeout);
        reject(error);
      });

      signalingWs.on("message", (data) => {
        const message = JSON.parse(data.toString());
        console.log("📨 WebSocket message:", message);
      });
    });

    // Step 3: Test offer/answer exchange (mock)
    console.log("\n3️⃣ Testing offer/answer exchange...");
    const mockOffer = {
      sdp: "v=0\r\no=- 1234567890 1234567890 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:test\r\na=ice-pwd:test\r\na=ice-options:trickle\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:actpass\r\na=mid:0\r\na=sendonly\r\na=rtcp-mux\r\na=rtpmap:111 opus/48000/2\r\n",
      type: "offer",
      chat_id: CHAT_ID,
    };

    const offerResponse = await fetch(`${API_BASE}/rtc/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mockOffer),
    });

    if (!offerResponse.ok) {
      throw new Error(`Offer request failed: ${offerResponse.statusText}`);
    }

    const answer = await offerResponse.json();
    console.log("✅ Received answer:", {
      type: answer.type,
      sdpLength: answer.sdp?.length || 0,
    });

    // Step 4: Test ICE candidate exchange (mock)
    console.log("\n4️⃣ Testing ICE candidate exchange...");
    const mockCandidate = {
      type: "ice-candidate",
      candidate: {
        candidate: "candidate:1 1 UDP 2130706431 127.0.0.1 54400 typ host",
        sdpMLineIndex: 0,
        sdpMid: "0",
      },
    };

    signalingWs.send(JSON.stringify(mockCandidate));
    console.log("✅ Sent mock ICE candidate");

    // Wait a bit for any responses
    await new Promise((resolve) => setTimeout(resolve, 2000));

    signalingWs.close();
    console.log("\n🎉 WebRTC debug test completed successfully!");
  } catch (error) {
    console.error("\n❌ WebRTC debug test failed:", error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down WebRTC debug test...");
  process.exit(0);
});

// Run the test
testWebRTCFlow().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
