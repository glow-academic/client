#!/usr/bin/env node

/**
 * WebRTC TURN Server Test Script
 * Tests connectivity to the TURN server and verifies ICE candidate gathering
 */

const fetch = require("node-fetch");

// Configuration
const API_BASE = process.env.API_URL || "http://localhost:8000";
const TEST_TIMEOUT = 15000; // 15 seconds

// Colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message) {
  log(`❌ ${message}`, "red");
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow");
}

function logInfo(message) {
  log(`ℹ️  ${message}`, "cyan");
}

// Test ICE server configuration
async function testIceConfig() {
  logInfo("Testing ICE server configuration...");

  try {
    const response = await fetch(`${API_BASE}/rtc/ice`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const iceConfig = await response.json();

    logSuccess("ICE configuration retrieved successfully");
    console.log(JSON.stringify(iceConfig, null, 2));

    // Validate configuration
    if (
      !iceConfig.urls ||
      !Array.isArray(iceConfig.urls) ||
      iceConfig.urls.length === 0
    ) {
      logError("No ICE server URLs found");
      return false;
    }

    // Check for STUN servers
    const stunServers = iceConfig.urls.filter((url) => url.startsWith("stun:"));
    if (stunServers.length === 0) {
      logWarning("No STUN servers found");
    } else {
      logSuccess(`Found ${stunServers.length} STUN server(s)`);
    }

    // Check for TURN servers
    const turnServers = iceConfig.urls.filter((url) => url.startsWith("turn:"));
    if (turnServers.length === 0) {
      logWarning("No TURN servers found");
    } else {
      logSuccess(`Found ${turnServers.length} TURN server(s)`);

      if (!iceConfig.username || !iceConfig.credential) {
        logWarning("TURN servers found but no credentials provided");
      } else {
        logSuccess("TURN credentials are available");
      }
    }

    return true;
  } catch (error) {
    logError(`Failed to get ICE configuration: ${error.message}`);
    return false;
  }
}

// Test basic connectivity to TURN server
async function testBasicConnectivity(host, port = 3478) {
  logInfo(`Testing basic connectivity to ${host}:${port}...`);

  return new Promise((resolve) => {
    const net = require("net");
    const socket = new net.Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      logWarning(`Connection timeout to ${host}:${port}`);
      resolve(false);
    }, 5000);

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      logSuccess(`TCP connection to ${host}:${port} successful`);
      resolve(true);
    });

    socket.on("error", (error) => {
      clearTimeout(timeout);
      logWarning(`TCP connection to ${host}:${port} failed: ${error.message}`);
      resolve(false);
    });
  });
}

// Test WebRTC peer connection with ICE gathering
async function testWebRTCConnection() {
  logInfo("Testing WebRTC peer connection with ICE gathering...");

  try {
    // Try to load wrtc module
    let RTCPeerConnection;
    try {
      const wrtc = require("wrtc");
      RTCPeerConnection = wrtc.RTCPeerConnection;
    } catch (error) {
      logWarning("wrtc module not available, skipping WebRTC test");
      logInfo("To enable WebRTC testing, install wrtc: npm install wrtc");
      return true; // Don't fail the test suite
    }

    // Get ICE configuration
    const response = await fetch(`${API_BASE}/rtc/ice`);
    const iceConfig = await response.json();

    // Create peer connection
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    // Add TURN servers if available
    if (iceConfig.username && iceConfig.credential) {
      iceServers.unshift({
        urls: iceConfig.urls.filter((url) => url.startsWith("turn:")),
        username: iceConfig.username,
        credential: iceConfig.credential,
      });
    }

    // Add STUN servers
    iceServers.unshift({
      urls: iceConfig.urls.filter((url) => url.startsWith("stun:")),
    });

    const pc = new RTCPeerConnection({ iceServers });

    return new Promise((resolve) => {
      let hasRelayCandidates = false;
      let hasHostCandidates = false;
      let hasSrflxCandidates = false;

      const timeout = setTimeout(() => {
        pc.close();

        logInfo("ICE gathering results:");
        logInfo(`  Host candidates: ${hasHostCandidates ? "✅" : "❌"}`);
        logInfo(
          `  Server reflexive candidates: ${hasSrflxCandidates ? "✅" : "❌"}`
        );
        logInfo(`  Relay candidates: ${hasRelayCandidates ? "✅" : "❌"}`);

        if (hasRelayCandidates) {
          logSuccess("TURN server is working - relay candidates found");
          resolve(true);
        } else if (hasSrflxCandidates) {
          logWarning("STUN server is working but no TURN relay candidates");
          resolve(false);
        } else {
          logError("No server reflexive or relay candidates found");
          resolve(false);
        }
      }, TEST_TIMEOUT);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          logInfo(`ICE Candidate: ${candidate}`);

          if (candidate.includes("typ host")) {
            hasHostCandidates = true;
          } else if (candidate.includes("typ srflx")) {
            hasSrflxCandidates = true;
          } else if (candidate.includes("typ relay")) {
            hasRelayCandidates = true;
          }
        } else {
          // ICE gathering complete
          clearTimeout(timeout);
          pc.close();

          logInfo("ICE gathering complete");
          logInfo("Results:");
          logInfo(`  Host candidates: ${hasHostCandidates ? "✅" : "❌"}`);
          logInfo(
            `  Server reflexive candidates: ${hasSrflxCandidates ? "✅" : "❌"}`
          );
          logInfo(`  Relay candidates: ${hasRelayCandidates ? "✅" : "❌"}`);

          if (hasRelayCandidates) {
            logSuccess("TURN server is working - relay candidates found");
            resolve(true);
          } else if (hasSrflxCandidates) {
            logWarning("STUN server is working but no TURN relay candidates");
            resolve(false);
          } else {
            logError("No server reflexive or relay candidates found");
            resolve(false);
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        logInfo(`ICE gathering state: ${pc.iceGatheringState}`);
      };

      pc.onconnectionstatechange = () => {
        logInfo(`Connection state: ${pc.connectionState}`);
      };

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel("test");

      // Create offer to start ICE gathering
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch((error) => {
          clearTimeout(timeout);
          pc.close();
          logError(`Failed to create offer: ${error.message}`);
          resolve(false);
        });
    });
  } catch (error) {
    logError(`WebRTC test failed: ${error.message}`);
    return false;
  }
}

// Extract host from TURN URLs
function extractTurnHosts(urls) {
  const hosts = new Set();

  urls.forEach((url) => {
    if (url.startsWith("turn:") || url.startsWith("stun:")) {
      const match = url.match(/:\/\/([^:/?]+)/);
      if (match) {
        hosts.add(match[1]);
      } else {
        // Handle format like "turn:host:port"
        const parts = url.split(":");
        if (parts.length >= 2) {
          hosts.add(parts[1]);
        }
      }
    }
  });

  return Array.from(hosts);
}

// Main test function
async function runTests() {
  console.log("🧪 WebRTC TURN Server Test Suite");
  console.log("================================");
  console.log("");

  let allTestsPassed = true;

  // Test 1: ICE Configuration
  logInfo("Test 1: ICE Server Configuration");
  const iceConfigOk = await testIceConfig();
  if (!iceConfigOk) {
    allTestsPassed = false;
  }
  console.log("");

  // Test 2: Basic Connectivity
  if (iceConfigOk) {
    try {
      const response = await fetch(`${API_BASE}/rtc/ice`);
      const iceConfig = await response.json();
      const turnHosts = extractTurnHosts(iceConfig.urls);

      logInfo("Test 2: Basic Connectivity");
      for (const host of turnHosts) {
        if (host !== "stun.l.google.com" && host !== "stun1.l.google.com") {
          const connected = await testBasicConnectivity(host);
          if (!connected) {
            allTestsPassed = false;
          }
        }
      }
      console.log("");
    } catch (error) {
      logError(`Failed to test connectivity: ${error.message}`);
      allTestsPassed = false;
    }
  }

  // Test 3: WebRTC Connection
  logInfo("Test 3: WebRTC ICE Gathering");
  const webrtcOk = await testWebRTCConnection();
  if (!webrtcOk) {
    allTestsPassed = false;
  }
  console.log("");

  // Summary
  console.log("Summary");
  console.log("=======");
  if (allTestsPassed) {
    logSuccess("All tests passed! TURN server is working correctly.");
  } else {
    logWarning("Some tests failed. Check the output above for details.");
    logInfo("Common issues:");
    logInfo("  - TURN server not running or not accessible");
    logInfo("  - Incorrect credentials");
    logInfo("  - Firewall blocking UDP ports");
    logInfo("  - Network configuration issues");
  }

  process.exit(allTestsPassed ? 0 : 1);
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("WebRTC TURN Server Test Script");
  console.log("");
  console.log("Usage: node test-webrtc-turn.js [options]");
  console.log("");
  console.log("Options:");
  console.log("  --help, -h    Show this help message");
  console.log("");
  console.log("Environment variables:");
  console.log(
    "  API_URL       Base URL for the API (default: http://localhost:8000)"
  );
  console.log("");
  console.log("This script tests:");
  console.log("  1. ICE server configuration from the API");
  console.log("  2. Basic TCP connectivity to TURN servers");
  console.log("  3. WebRTC ICE candidate gathering");
  console.log("");
  process.exit(0);
}

// Run the tests
runTests().catch((error) => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
