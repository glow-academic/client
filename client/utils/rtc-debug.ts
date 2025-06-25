/**
 * WebRTC Debug Utilities
 * Helper functions for debugging WebRTC connections and audio transcription
 */

import { logError, logInfo } from "./logger";

export interface WebRTCDebugInfo {
  chatId: string;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
  localDescription?: RTCSessionDescriptionInit | null;
  remoteDescription?: RTCSessionDescriptionInit | null;
  iceServers: RTCIceServer[];
}

export interface WebRTCStats {
  chatId: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  audioLevel?: number;
  timestamp: number;
}

/**
 * Get comprehensive debug information about a WebRTC connection
 */
export function getWebRTCDebugInfo(
  chatId: string,
  pc: RTCPeerConnection,
  iceServers: RTCIceServer[]
): WebRTCDebugInfo {
  return {
    chatId,
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    iceGatheringState: pc.iceGatheringState,
    signalingState: pc.signalingState,
    localDescription: pc.localDescription,
    remoteDescription: pc.remoteDescription,
    iceServers,
  };
}

/**
 * Log comprehensive WebRTC debug information
 */
export function logWebRTCDebugInfo(debugInfo: WebRTCDebugInfo): void {
  logInfo("WebRTC Debug Info", {
    chatId: debugInfo.chatId,
    connectionState: debugInfo.connectionState,
    iceConnectionState: debugInfo.iceConnectionState,
    iceGatheringState: debugInfo.iceGatheringState,
    signalingState: debugInfo.signalingState,
    hasLocalDescription: !!debugInfo.localDescription,
    hasRemoteDescription: !!debugInfo.remoteDescription,
    iceServersCount: debugInfo.iceServers.length,
  });
}

/**
 * Get WebRTC statistics for monitoring
 */
export async function getWebRTCStats(
  chatId: string,
  pc: RTCPeerConnection
): Promise<WebRTCStats | null> {
  try {
    const stats = await pc.getStats();
    let bytesReceived = 0;
    let bytesSent = 0;
    let packetsReceived = 0;
    let packetsSent = 0;
    let audioLevel: number | undefined;

    stats.forEach((report) => {
      if (report.type === "inbound-rtp" && report.mediaType === "audio") {
        bytesReceived += report.bytesReceived || 0;
        packetsReceived += report.packetsReceived || 0;
      } else if (
        report.type === "outbound-rtp" &&
        report.mediaType === "audio"
      ) {
        bytesSent += report.bytesSent || 0;
        packetsSent += report.packetsSent || 0;
      } else if (report.type === "media-source" && report.kind === "audio") {
        audioLevel = report.audioLevel;
      }
    });

    return {
      chatId,
      bytesReceived,
      bytesSent,
      packetsReceived,
      packetsSent,
      audioLevel,
      timestamp: Date.now(),
    };
  } catch (error) {
    logError("Failed to get WebRTC stats", error);
    return null;
  }
}

/**
 * Monitor WebRTC connection health
 */
export function monitorWebRTCHealth(
  chatId: string,
  pc: RTCPeerConnection,
  intervalMs: number = 5000
): () => void {
  const interval = setInterval(async () => {
    const stats = await getWebRTCStats(chatId, pc);
    if (stats) {
      logInfo("WebRTC Health Check", {
        chatId: stats.chatId,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        bytesReceived: stats.bytesReceived,
        bytesSent: stats.bytesSent,
        audioLevel: stats.audioLevel,
      });
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

/**
 * Test WebRTC browser compatibility
 */
export function testWebRTCCompatibility(): {
  supported: boolean;
  features: {
    rtcPeerConnection: boolean;
    getUserMedia: boolean;
    webAudio: boolean;
    webSocket: boolean;
  };
  issues: string[];
} {
  const features = {
    rtcPeerConnection: typeof RTCPeerConnection !== "undefined",
    getUserMedia:
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia !== "undefined",
    webAudio:
      typeof AudioContext !== "undefined" ||
      typeof (window as any).webkitAudioContext !== "undefined",
    webSocket: typeof WebSocket !== "undefined",
  };

  const issues: string[] = [];

  if (!features.rtcPeerConnection) {
    issues.push("RTCPeerConnection not supported");
  }
  if (!features.getUserMedia) {
    issues.push("getUserMedia not supported");
  }
  if (!features.webAudio) {
    issues.push("Web Audio API not supported");
  }
  if (!features.webSocket) {
    issues.push("WebSocket not supported");
  }

  const supported = Object.values(features).every(Boolean);

  return {
    supported,
    features,
    issues,
  };
}

/**
 * Create a comprehensive WebRTC diagnostic report
 */
export function createWebRTCDiagnosticReport(
  chatId: string,
  pc: RTCPeerConnection,
  iceServers: RTCIceServer[],
  error?: Error
): string {
  const compatibility = testWebRTCCompatibility();
  const debugInfo = getWebRTCDebugInfo(chatId, pc, iceServers);

  const report = [
    "=== WebRTC Diagnostic Report ===",
    `Chat ID: ${chatId}`,
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "Browser Compatibility:",
    `- Supported: ${compatibility.supported}`,
    `- RTCPeerConnection: ${compatibility.features.rtcPeerConnection}`,
    `- getUserMedia: ${compatibility.features.getUserMedia}`,
    `- Web Audio: ${compatibility.features.webAudio}`,
    `- WebSocket: ${compatibility.features.webSocket}`,
    ...(compatibility.issues.length > 0
      ? ["Issues:", ...compatibility.issues.map((issue) => `- ${issue}`)]
      : []),
    "",
    "Connection State:",
    `- Connection: ${debugInfo.connectionState}`,
    `- ICE Connection: ${debugInfo.iceConnectionState}`,
    `- ICE Gathering: ${debugInfo.iceGatheringState}`,
    `- Signaling: ${debugInfo.signalingState}`,
    "",
    "Descriptions:",
    `- Local Description: ${debugInfo.localDescription ? "Present" : "Missing"}`,
    `- Remote Description: ${debugInfo.remoteDescription ? "Present" : "Missing"}`,
    "",
    "ICE Configuration:",
    `- ICE Servers: ${debugInfo.iceServers.length}`,
    ...debugInfo.iceServers.map(
      (server, index) => `  ${index + 1}. ${server.urls}`
    ),
    "",
    ...(error
      ? [
          "Error Information:",
          `- Message: ${error.message}`,
          `- Stack: ${error.stack || "Not available"}`,
          "",
        ]
      : []),
    "=== End Report ===",
  ];

  return report.join("\n");
}
