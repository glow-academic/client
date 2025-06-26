/**
 * WebRTC Debugging and Monitoring Utilities
 * Provides comprehensive logging and state monitoring for WebRTC connections
 */

import { logError, logInfo, logWarn } from "./logger";

export interface WebRTCConnectionStats {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
  iceCandidatesReceived: number;
  iceCandidatesSent: number;
  dataChannelsOpen: number;
  lastStateChange: Date;
  errors: string[];
}

export interface WebRTCDebugConfig {
  enableDetailedLogging: boolean;
  monitorInterval: number; // milliseconds
  maxErrorHistory: number;
  autoReconnectAttempts: number;
}

export class WebRTCDebugger {
  private config: WebRTCDebugConfig;
  private stats: Map<string, WebRTCConnectionStats> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<string, (() => void)[]> = new Map();

  constructor(config: Partial<WebRTCDebugConfig> = {}) {
    this.config = {
      enableDetailedLogging: true,
      monitorInterval: 5000,
      maxErrorHistory: 10,
      autoReconnectAttempts: 3,
      ...config,
    };
  }

  /**
   * Start monitoring a WebRTC peer connection
   */
  startMonitoring(
    connectionId: string,
    peerConnection: RTCPeerConnection,
    onStateChange?: (stats: WebRTCConnectionStats) => void
  ): void {
    logInfo(`Starting WebRTC monitoring for connection: ${connectionId}`);

    // Initialize stats
    this.stats.set(connectionId, {
      connectionState: peerConnection.connectionState,
      iceConnectionState: peerConnection.iceConnectionState,
      iceGatheringState: peerConnection.iceGatheringState,
      signalingState: peerConnection.signalingState,
      iceCandidatesReceived: 0,
      iceCandidatesSent: 0,
      dataChannelsOpen: 0,
      lastStateChange: new Date(),
      errors: [],
    });

    // Set up event listeners
    const listeners: (() => void)[] = [];

    const onConnectionStateChange = () => {
      this.updateConnectionState(connectionId, peerConnection);
      if (this.config.enableDetailedLogging) {
        logInfo(
          `WebRTC connection state changed: ${peerConnection.connectionState}`,
          { connectionId }
        );
      }
      if (onStateChange) {
        const stats = this.stats.get(connectionId);
        if (stats) onStateChange(stats);
      }
    };

    const onIceConnectionStateChange = () => {
      this.updateConnectionState(connectionId, peerConnection);
      if (this.config.enableDetailedLogging) {
        logInfo(
          `WebRTC ICE connection state changed: ${peerConnection.iceConnectionState}`,
          { connectionId }
        );
      }

      // Handle ICE connection failures
      if (peerConnection.iceConnectionState === "failed") {
        this.addError(connectionId, "ICE connection failed");
        logError(`ICE connection failed for ${connectionId}`);
      } else if (peerConnection.iceConnectionState === "disconnected") {
        logWarn(`ICE connection disconnected for ${connectionId}`);
      }
    };

    const onIceGatheringStateChange = () => {
      this.updateConnectionState(connectionId, peerConnection);
      if (this.config.enableDetailedLogging) {
        logInfo(
          `WebRTC ICE gathering state changed: ${peerConnection.iceGatheringState}`,
          { connectionId }
        );
      }
    };

    const onSignalingStateChange = () => {
      this.updateConnectionState(connectionId, peerConnection);
      if (this.config.enableDetailedLogging) {
        logInfo(
          `WebRTC signaling state changed: ${peerConnection.signalingState}`,
          { connectionId }
        );
      }
    };

    const onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        this.incrementSentCandidates(connectionId);
        if (this.config.enableDetailedLogging) {
          logInfo(`ICE candidate sent`, {
            connectionId,
            candidate: event.candidate.candidate.substring(0, 50) + "...",
            type: this.extractCandidateType(event.candidate.candidate),
          });
        }
      } else {
        logInfo(`ICE gathering complete for ${connectionId}`);
      }
    };

    const onDataChannel = (event: RTCDataChannelEvent) => {
      this.incrementDataChannels(connectionId);
      logInfo(`Data channel received: ${event.channel.label}`, {
        connectionId,
      });

      event.channel.onopen = () => {
        logInfo(`Data channel opened: ${event.channel.label}`, {
          connectionId,
        });
      };

      event.channel.onclose = () => {
        this.decrementDataChannels(connectionId);
        logInfo(`Data channel closed: ${event.channel.label}`, {
          connectionId,
        });
      };

      event.channel.onerror = (error) => {
        this.addError(connectionId, `Data channel error: ${error}`);
        logError(`Data channel error for ${connectionId}`, error);
      };
    };

    // Add event listeners
    peerConnection.addEventListener(
      "connectionstatechange",
      onConnectionStateChange
    );
    peerConnection.addEventListener(
      "iceconnectionstatechange",
      onIceConnectionStateChange
    );
    peerConnection.addEventListener(
      "icegatheringstatechange",
      onIceGatheringStateChange
    );
    peerConnection.addEventListener(
      "signalingstatechange",
      onSignalingStateChange
    );
    peerConnection.addEventListener("icecandidate", onIceCandidate);
    peerConnection.addEventListener("datachannel", onDataChannel);

    listeners.push(
      () =>
        peerConnection.removeEventListener(
          "connectionstatechange",
          onConnectionStateChange
        ),
      () =>
        peerConnection.removeEventListener(
          "iceconnectionstatechange",
          onIceConnectionStateChange
        ),
      () =>
        peerConnection.removeEventListener(
          "icegatheringstatechange",
          onIceGatheringStateChange
        ),
      () =>
        peerConnection.removeEventListener(
          "signalingstatechange",
          onSignalingStateChange
        ),
      () => peerConnection.removeEventListener("icecandidate", onIceCandidate),
      () => peerConnection.removeEventListener("datachannel", onDataChannel)
    );

    this.eventListeners.set(connectionId, listeners);

    // Start periodic monitoring
    const interval = setInterval(() => {
      this.collectPeriodicStats(connectionId, peerConnection);
    }, this.config.monitorInterval);

    this.monitoringIntervals.set(connectionId, interval);

    logInfo(`WebRTC monitoring started for ${connectionId}`);
  }

  /**
   * Stop monitoring a WebRTC connection
   */
  stopMonitoring(connectionId: string): void {
    logInfo(`Stopping WebRTC monitoring for connection: ${connectionId}`);

    // Clear interval
    const interval = this.monitoringIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(connectionId);
    }

    // Remove event listeners
    const listeners = this.eventListeners.get(connectionId);
    if (listeners) {
      listeners.forEach((removeListener) => removeListener());
      this.eventListeners.delete(connectionId);
    }

    // Keep stats for potential debugging
    logInfo(`WebRTC monitoring stopped for ${connectionId}`);
  }

  /**
   * Get current stats for a connection
   */
  getStats(connectionId: string): WebRTCConnectionStats | undefined {
    return this.stats.get(connectionId);
  }

  /**
   * Get all connection stats
   */
  getAllStats(): Map<string, WebRTCConnectionStats> {
    return new Map(this.stats);
  }

  /**
   * Record that an ICE candidate was received
   */
  recordReceivedCandidate(
    connectionId: string,
    candidate: RTCIceCandidate
  ): void {
    this.incrementReceivedCandidates(connectionId);
    if (this.config.enableDetailedLogging) {
      logInfo(`ICE candidate received`, {
        connectionId,
        candidate: candidate.candidate.substring(0, 50) + "...",
        type: this.extractCandidateType(candidate.candidate),
      });
    }
  }

  /**
   * Generate a comprehensive debug report
   */
  generateDebugReport(connectionId?: string): string {
    const statsToReport = connectionId
      ? new Map([[connectionId, this.stats.get(connectionId)!]])
      : this.stats;

    let report = "=== WebRTC Debug Report ===\n\n";

    for (const [id, stats] of statsToReport) {
      if (!stats) continue;

      report += `Connection: ${id}\n`;
      report += `  Connection State: ${stats.connectionState}\n`;
      report += `  ICE Connection State: ${stats.iceConnectionState}\n`;
      report += `  ICE Gathering State: ${stats.iceGatheringState}\n`;
      report += `  Signaling State: ${stats.signalingState}\n`;
      report += `  ICE Candidates Sent: ${stats.iceCandidatesSent}\n`;
      report += `  ICE Candidates Received: ${stats.iceCandidatesReceived}\n`;
      report += `  Data Channels Open: ${stats.dataChannelsOpen}\n`;
      report += `  Last State Change: ${stats.lastStateChange.toISOString()}\n`;

      if (stats.errors.length > 0) {
        report += `  Recent Errors:\n`;
        stats.errors.forEach((error, index) => {
          report += `    ${index + 1}. ${error}\n`;
        });
      }
      report += "\n";
    }

    return report;
  }

  /**
   * Check if a connection is healthy
   */
  isConnectionHealthy(connectionId: string): boolean {
    const stats = this.stats.get(connectionId);
    if (!stats) return false;

    return (
      stats.connectionState === "connected" &&
      stats.iceConnectionState === "connected" &&
      stats.errors.length === 0
    );
  }

  /**
   * Get troubleshooting suggestions based on connection state
   */
  getTroubleshootingSuggestions(connectionId: string): string[] {
    const stats = this.stats.get(connectionId);
    if (!stats) return ["Connection not found"];

    const suggestions: string[] = [];

    if (stats.iceConnectionState === "failed") {
      suggestions.push(
        "ICE connection failed - check TURN server configuration"
      );
      suggestions.push("Verify network connectivity and firewall settings");
      suggestions.push("Check if TURN credentials are valid");
    }

    if (stats.iceCandidatesReceived === 0) {
      suggestions.push(
        "No ICE candidates received - check signaling connection"
      );
    }

    if (stats.iceCandidatesSent === 0) {
      suggestions.push(
        "No ICE candidates sent - check local network configuration"
      );
    }

    if (stats.connectionState === "failed") {
      suggestions.push(
        "Peer connection failed - consider restarting the connection"
      );
    }

    if (stats.errors.length > 0) {
      suggestions.push("Recent errors detected - check error logs for details");
    }

    if (suggestions.length === 0) {
      suggestions.push("Connection appears healthy");
    }

    return suggestions;
  }

  private updateConnectionState(
    connectionId: string,
    pc: RTCPeerConnection
  ): void {
    const stats = this.stats.get(connectionId);
    if (!stats) return;

    stats.connectionState = pc.connectionState;
    stats.iceConnectionState = pc.iceConnectionState;
    stats.iceGatheringState = pc.iceGatheringState;
    stats.signalingState = pc.signalingState;
    stats.lastStateChange = new Date();
  }

  private incrementSentCandidates(connectionId: string): void {
    const stats = this.stats.get(connectionId);
    if (stats) stats.iceCandidatesSent++;
  }

  private incrementReceivedCandidates(connectionId: string): void {
    const stats = this.stats.get(connectionId);
    if (stats) stats.iceCandidatesReceived++;
  }

  private incrementDataChannels(connectionId: string): void {
    const stats = this.stats.get(connectionId);
    if (stats) stats.dataChannelsOpen++;
  }

  private decrementDataChannels(connectionId: string): void {
    const stats = this.stats.get(connectionId);
    if (stats && stats.dataChannelsOpen > 0) stats.dataChannelsOpen--;
  }

  private addError(connectionId: string, error: string): void {
    const stats = this.stats.get(connectionId);
    if (!stats) return;

    stats.errors.push(error);
    if (stats.errors.length > this.config.maxErrorHistory) {
      stats.errors.shift();
    }
  }

  private extractCandidateType(candidate: string): string {
    if (candidate.includes("typ host")) return "host";
    if (candidate.includes("typ srflx")) return "srflx";
    if (candidate.includes("typ relay")) return "relay";
    return "unknown";
  }

  private collectPeriodicStats(
    connectionId: string,
    pc: RTCPeerConnection
  ): void {
    // Update basic stats
    this.updateConnectionState(connectionId, pc);

    // Log periodic health check if enabled
    if (this.config.enableDetailedLogging) {
      const stats = this.stats.get(connectionId);
      if (stats) {
        logInfo(`WebRTC health check for ${connectionId}`, {
          connectionState: stats.connectionState,
          iceConnectionState: stats.iceConnectionState,
          candidatesSent: stats.iceCandidatesSent,
          candidatesReceived: stats.iceCandidatesReceived,
          dataChannelsOpen: stats.dataChannelsOpen,
        });
      }
    }
  }
}

// Global debugger instance
export const webRTCDebugger = new WebRTCDebugger();

/**
 * Test WebRTC connectivity and return detailed results
 */
export async function testWebRTCConnectivity(): Promise<{
  success: boolean;
  results: {
    iceServers: boolean;
    stunConnectivity: boolean;
    turnConnectivity: boolean;
    dataChannels: boolean;
  };
  errors: string[];
}> {
  const results = {
    iceServers: false,
    stunConnectivity: false,
    turnConnectivity: false,
    dataChannels: false,
  };
  const errors: string[] = [];

  try {
    // Test ICE server configuration
    logInfo("Testing ICE server configuration...");
    const response = await fetch("/api/webrtc/ice");
    if (response.ok) {
      const iceConfig = await response.json();
      results.iceServers = iceConfig.urls && iceConfig.urls.length > 0;
      logInfo("ICE servers configured", { count: iceConfig.urls?.length || 0 });
    } else {
      errors.push("Failed to fetch ICE configuration");
    }

    // Test basic WebRTC functionality
    if (typeof RTCPeerConnection !== "undefined") {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Test data channel creation
      try {
        const dataChannel = pc.createDataChannel("test");
        results.dataChannels = true;
        dataChannel.close();
      } catch (error) {
        errors.push(`Data channel test failed: ${error}`);
      }

      pc.close();
    } else {
      errors.push("RTCPeerConnection not supported");
    }

    const success = results.iceServers && results.dataChannels;
    return { success, results, errors };
  } catch (error) {
    errors.push(`WebRTC connectivity test failed: ${error}`);
    return { success: false, results, errors };
  }
}

/**
 * Auto-diagnose WebRTC issues and provide recommendations
 */
export function diagnoseWebRTCIssues(connectionId: string): {
  diagnosis: string;
  severity: "low" | "medium" | "high";
  recommendations: string[];
} {
  const stats = webRTCDebugger.getStats(connectionId);

  if (!stats) {
    return {
      diagnosis: "Connection not found or not being monitored",
      severity: "high",
      recommendations: ["Start WebRTC monitoring for this connection"],
    };
  }

  // Analyze connection state
  if (stats.connectionState === "failed") {
    return {
      diagnosis: "WebRTC peer connection has failed",
      severity: "high",
      recommendations: [
        "Restart the WebRTC connection",
        "Check network connectivity",
        "Verify TURN server configuration",
        "Check browser console for additional errors",
      ],
    };
  }

  if (stats.iceConnectionState === "failed") {
    return {
      diagnosis: "ICE connection establishment failed",
      severity: "high",
      recommendations: [
        "Check TURN server connectivity",
        "Verify firewall settings",
        "Test with different network connection",
        "Check TURN credentials validity",
      ],
    };
  }

  if (stats.iceConnectionState === "disconnected") {
    return {
      diagnosis: "ICE connection is disconnected",
      severity: "medium",
      recommendations: [
        "Monitor for automatic reconnection",
        "Check network stability",
        "Consider implementing ICE restart",
      ],
    };
  }

  if (stats.iceCandidatesReceived === 0 && stats.iceCandidatesSent === 0) {
    return {
      diagnosis: "No ICE candidates exchanged",
      severity: "high",
      recommendations: [
        "Check WebSocket signaling connection",
        "Verify ICE candidate exchange implementation",
        "Check for JavaScript errors in console",
      ],
    };
  }

  if (stats.errors.length > 0) {
    return {
      diagnosis: `Recent errors detected: ${stats.errors[stats.errors.length - 1]}`,
      severity: "medium",
      recommendations: [
        "Review error logs for patterns",
        "Check for network interruptions",
        "Consider implementing error recovery",
      ],
    };
  }

  return {
    diagnosis: "Connection appears healthy",
    severity: "low",
    recommendations: ["Continue monitoring"],
  };
}
