/**
 * WebRTC Diagnostic Script
 * Run this in the browser console to diagnose WebRTC connectivity issues
 *
 * Usage: Copy and paste this entire script into the browser console and press Enter
 */

(function () {
  "use strict";

  console.log("🔍 WebRTC Diagnostic Tool Starting...\n");

  // Test results
  const results = {
    browser: {},
    webrtc: {},
    ice: {},
    connectivity: {},
    errors: [],
  };

  // Browser detection
  function detectBrowser() {
    console.log("📱 Detecting browser capabilities...");

    const userAgent = navigator.userAgent;
    results.browser = {
      userAgent,
      webRTCSupported: typeof RTCPeerConnection !== "undefined",
      getUserMediaSupported:
        typeof navigator.mediaDevices?.getUserMedia !== "undefined",
      webSocketSupported: typeof WebSocket !== "undefined",
      isSecureContext: window.isSecureContext,
    };

    console.log("✅ Browser Detection Results:");
    console.table(results.browser);

    if (!results.browser.webRTCSupported) {
      results.errors.push("❌ WebRTC is not supported in this browser");
    }

    if (!results.browser.isSecureContext) {
      results.errors.push(
        "⚠️  Page is not served over HTTPS - WebRTC may not work properly"
      );
    }
  }

  // Test basic WebRTC functionality
  async function testBasicWebRTC() {
    console.log("\n🔧 Testing basic WebRTC functionality...");

    try {
      const pc = new RTCPeerConnection();

      results.webrtc = {
        peerConnectionCreated: true,
        initialConnectionState: pc.connectionState,
        initialIceConnectionState: pc.iceConnectionState,
        initialIceGatheringState: pc.iceGatheringState,
        initialSignalingState: pc.signalingState,
      };

      // Test data channel creation
      try {
        const dataChannel = pc.createDataChannel("test");
        results.webrtc.dataChannelSupported = true;
        dataChannel.close();
      } catch (error) {
        results.webrtc.dataChannelSupported = false;
        results.errors.push(
          `❌ Data channel creation failed: ${error.message}`
        );
      }

      pc.close();

      console.log("✅ Basic WebRTC Test Results:");
      console.table(results.webrtc);
    } catch (error) {
      results.webrtc.error = error.message;
      results.errors.push(`❌ Basic WebRTC test failed: ${error.message}`);
      console.error("❌ Basic WebRTC test failed:", error);
    }
  }

  // Test ICE server configuration
  async function testICEConfiguration() {
    console.log("\n🧊 Testing ICE server configuration...");

    try {
      // Test fetching ICE configuration from server
      let iceConfig = null;
      try {
        const response = await fetch("/api/webrtc/ice");
        if (response.ok) {
          iceConfig = await response.json();
          results.ice.serverConfigAvailable = true;
          results.ice.serverConfig = iceConfig;
        } else {
          results.ice.serverConfigAvailable = false;
          results.errors.push(
            `⚠️  Could not fetch ICE config from server: ${response.status}`
          );
        }
      } catch (error) {
        results.ice.serverConfigAvailable = false;
        results.errors.push(`⚠️  Could not fetch ICE config: ${error.message}`);
      }

      // Test with default STUN servers
      const defaultIceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];

      const pc = new RTCPeerConnection({ iceServers: defaultIceServers });

      results.ice.defaultStunServers = true;

      // Test ICE candidate gathering
      const candidatePromise = new Promise((resolve) => {
        const candidates = [];
        let candidateTypes = new Set();

        const timeout = setTimeout(() => {
          resolve({ candidates, candidateTypes: Array.from(candidateTypes) });
        }, 5000);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidates.push(event.candidate.candidate);

            // Extract candidate type
            if (event.candidate.candidate.includes("typ host")) {
              candidateTypes.add("host");
            } else if (event.candidate.candidate.includes("typ srflx")) {
              candidateTypes.add("srflx");
            } else if (event.candidate.candidate.includes("typ relay")) {
              candidateTypes.add("relay");
            }
          } else {
            clearTimeout(timeout);
            resolve({ candidates, candidateTypes: Array.from(candidateTypes) });
          }
        };

        // Create data channel to trigger ICE gathering
        pc.createDataChannel("test");
        pc.createOffer().then((offer) => pc.setLocalDescription(offer));
      });

      const candidateResults = await candidatePromise;
      results.ice.candidatesGathered = candidateResults.candidates.length;
      results.ice.candidateTypes = candidateResults.candidateTypes;

      pc.close();

      console.log("✅ ICE Configuration Test Results:");
      console.table(results.ice);

      if (candidateResults.candidateTypes.includes("srflx")) {
        console.log(
          "✅ STUN servers are working - server reflexive candidates found"
        );
      } else {
        results.errors.push(
          "⚠️  No server reflexive candidates found - STUN servers may not be working"
        );
      }

      if (candidateResults.candidateTypes.includes("relay")) {
        console.log("✅ TURN servers are working - relay candidates found");
      } else {
        results.errors.push(
          "⚠️  No relay candidates found - TURN servers may not be configured"
        );
      }
    } catch (error) {
      results.ice.error = error.message;
      results.errors.push(`❌ ICE configuration test failed: ${error.message}`);
      console.error("❌ ICE configuration test failed:", error);
    }
  }

  // Test network connectivity
  async function testConnectivity() {
    console.log("\n🌐 Testing network connectivity...");

    try {
      // Test WebSocket connection to server
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/socket.io/?EIO=4&transport=websocket`;

      const wsTest = new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });

      results.connectivity.websocketConnection = await wsTest;

      // Test basic HTTP connectivity
      try {
        const response = await fetch("/api/auth/session", { method: "GET" });
        results.connectivity.httpConnection = response.ok;
      } catch (error) {
        results.connectivity.httpConnection = false;
        results.errors.push(
          `⚠️  HTTP connectivity test failed: ${error.message}`
        );
      }

      console.log("✅ Connectivity Test Results:");
      console.table(results.connectivity);
    } catch (error) {
      results.connectivity.error = error.message;
      results.errors.push(`❌ Connectivity test failed: ${error.message}`);
      console.error("❌ Connectivity test failed:", error);
    }
  }

  // Generate summary report
  function generateReport() {
    console.log("\n📋 DIAGNOSTIC SUMMARY REPORT");
    console.log("=".repeat(50));

    // Overall health check
    const criticalIssues = results.errors.filter((error) =>
      error.includes("❌")
    ).length;
    const warnings = results.errors.filter((error) =>
      error.includes("⚠️")
    ).length;

    if (criticalIssues === 0 && warnings === 0) {
      console.log("🎉 Overall Status: HEALTHY - No issues detected");
    } else if (criticalIssues === 0) {
      console.log(`⚠️  Overall Status: WARNING - ${warnings} warnings found`);
    } else {
      console.log(
        `❌ Overall Status: CRITICAL - ${criticalIssues} critical issues found`
      );
    }

    console.log("\n🔍 Detailed Results:");
    console.log(
      "Browser Support:",
      results.browser.webRTCSupported ? "✅" : "❌"
    );
    console.log(
      "Secure Context:",
      results.browser.isSecureContext ? "✅" : "❌"
    );
    console.log(
      "WebRTC Basic:",
      results.webrtc.peerConnectionCreated ? "✅" : "❌"
    );
    console.log(
      "Data Channels:",
      results.webrtc.dataChannelSupported ? "✅" : "❌"
    );
    console.log(
      "ICE Candidates:",
      results.ice.candidatesGathered > 0
        ? `✅ (${results.ice.candidatesGathered})`
        : "❌"
    );
    console.log(
      "STUN Working:",
      results.ice.candidateTypes?.includes("srflx") ? "✅" : "⚠️"
    );
    console.log(
      "TURN Working:",
      results.ice.candidateTypes?.includes("relay") ? "✅" : "⚠️"
    );
    console.log(
      "WebSocket:",
      results.connectivity.websocketConnection ? "✅" : "❌"
    );
    console.log("HTTP:", results.connectivity.httpConnection ? "✅" : "❌");

    if (results.errors.length > 0) {
      console.log("\n⚠️  Issues Found:");
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log("\n💡 Troubleshooting Tips:");

    if (criticalIssues > 0) {
      console.log(
        "• Check that you're using a modern browser with WebRTC support"
      );
      console.log("• Ensure the page is served over HTTPS");
      console.log("• Verify network connectivity and firewall settings");
    }

    if (!results.ice.candidateTypes?.includes("srflx")) {
      console.log("• STUN servers may be blocked - check firewall settings");
      console.log("• Try connecting from a different network");
    }

    if (!results.ice.candidateTypes?.includes("relay")) {
      console.log("• TURN servers may not be configured or accessible");
      console.log("• Contact system administrator to verify TURN server setup");
    }

    if (!results.connectivity.websocketConnection) {
      console.log("• WebSocket connection failed - check server status");
      console.log("• Verify that WebSocket traffic is not blocked");
    }

    console.log("\n📊 Full Results Object:");
    console.log(JSON.stringify(results, null, 2));

    // Copy to clipboard if available
    if (navigator.clipboard) {
      const reportText = `WebRTC Diagnostic Report\n${"=".repeat(30)}\n\n${JSON.stringify(results, null, 2)}`;
      navigator.clipboard
        .writeText(reportText)
        .then(() => {
          console.log("\n📋 Report copied to clipboard!");
        })
        .catch(() => {
          console.log(
            "\n📋 Could not copy to clipboard, but results are logged above"
          );
        });
    }
  }

  // Run all tests
  async function runDiagnostics() {
    try {
      detectBrowser();
      await testBasicWebRTC();
      await testICEConfiguration();
      await testConnectivity();
      generateReport();
    } catch (error) {
      console.error("❌ Diagnostic tool failed:", error);
      results.errors.push(`❌ Diagnostic tool failed: ${error.message}`);
    }
  }

  // Start diagnostics
  runDiagnostics();
})();
