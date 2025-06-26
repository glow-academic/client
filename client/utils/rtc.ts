/**
 * client/utils/rtc.ts
 */

import { logError, logInfo } from "./logger";

// Store active connections
const activeConnections = new Map<string, RTCPeerConnection>();
const activeStreams = new Map<string, MediaStream>();
const activeSignalingWs = new Map<string, WebSocket>();

interface IceConfig {
  urls: string[];
  username: string | null;
  credential: string | null;
}

interface RTCOffer {
  sdp: string;
  type: string;
  chat_id: string;
}

interface RTCAnswer {
  sdp: string;
  type: string;
}

// Get API URL helper
const getApiUrl = (): string => {
  const baseUrl = process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8000";
  return baseUrl.replace(/\/$/, ""); // Remove trailing slash
};

const fetchIce = async (): Promise<IceConfig> => {
  const response = await fetch(`${getApiUrl()}/rtc/ice`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ICE config: ${response.statusText}`);
  }
  return response.json();
};

// Create signaling WebSocket with promise-based connection
const createSignalingWebSocket = (chatId: string): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const apiUrl = getApiUrl();
    const wsUrl = apiUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/rtc/signaling/${chatId}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timeout"));
    }, 10000); // Increased timeout to 10 seconds

    ws.onopen = () => {
      clearTimeout(timeout);
      logInfo(`WebSocket signaling connected for chat ${chatId}`);
      resolve(ws);
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      logError(`WebSocket signaling error for chat ${chatId}`, error);
      reject(error);
    };

    ws.onclose = (event) => {
      logInfo(`WebSocket signaling closed for chat ${chatId}`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      activeSignalingWs.delete(chatId);
    };
  });
};

/**
 * Start WebRTC audio streaming for a chat
 */
export async function startRtcAudio(chatId: string): Promise<void> {
  try {
    logInfo(`Starting WebRTC audio for chat ${chatId}`);

    // Stop any existing connection for this chat
    if (activeConnections.has(chatId)) {
      await stopRtcAudio(chatId);
    }

    // Request user media first
    logInfo(`Requesting user media for chat ${chatId}`);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      },
      video: false,
    });

    logInfo(`Got user media stream for chat ${chatId}`, {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });

    // Store stream immediately to prevent cleanup issues
    activeStreams.set(chatId, stream);

    // Fetch ICE configuration
    const iceConfig = await fetchIce();
    logInfo(`Fetched ICE config`, { urls: iceConfig.urls.length });

    // Create peer connection with ICE servers
    const iceServers: RTCIceServer[] = [
      // Default STUN servers as fallback
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    // Add configured ICE servers
    if (iceConfig.urls && iceConfig.urls.length > 0) {
      if (iceConfig.username && iceConfig.credential) {
        // Add as TURN servers with credentials
        iceServers.unshift({
          urls: iceConfig.urls,
          username: iceConfig.username,
          credential: iceConfig.credential,
        });
        logInfo(`Added TURN servers with credentials`);
      } else {
        // Add as STUN servers if no credentials
        iceServers.unshift({ urls: iceConfig.urls });
        logInfo(`Added servers as STUN (no credentials provided)`);
      }
    }

    const peerConnection = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10, // Pre-gather candidates
    });

    // Store connection immediately
    activeConnections.set(chatId, peerConnection);

    // Track connection state for debugging
    let connectionEstablished = false;
    let iceCandidatesBuffer: RTCIceCandidate[] = [];

    // Create signaling WebSocket FIRST (before setting up ICE candidate handler)
    logInfo(`Creating signaling WebSocket for chat ${chatId}`);
    const signalingWs = await createSignalingWebSocket(chatId);
    activeSignalingWs.set(chatId, signalingWs);

    // Set up ping mechanism to keep WebSocket alive
    const pingInterval = setInterval(() => {
      if (signalingWs.readyState === WebSocket.OPEN) {
        signalingWs.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // Ping every 30 seconds

    // Clean up ping interval when WebSocket closes
    const originalOnClose = signalingWs.onclose;
    signalingWs.onclose = (event) => {
      clearInterval(pingInterval);
      if (originalOnClose) {
        originalOnClose.call(signalingWs, event);
      }
    };

    // Handle incoming ICE candidates from server
    signalingWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ice-candidate" && data.candidate) {
          // Check if peer connection is still valid
          if (peerConnection.connectionState === "closed") {
            logError(
              `Cannot add ICE candidate - peer connection closed for chat ${chatId}`
            );
            return;
          }

          const candidate = new RTCIceCandidate({
            candidate: data.candidate.candidate,
            sdpMid: data.candidate.sdpMid,
            sdpMLineIndex: data.candidate.sdpMLineIndex,
          });

          peerConnection.addIceCandidate(candidate).catch((error) => {
            logError(`Failed to add ICE candidate for chat ${chatId}`, error);
          });

          logInfo(`Received and added ICE candidate for chat ${chatId}`);
        } else if (data.type === "pong") {
          // Handle pong response (just log for debugging)
          logInfo(`Received pong from server for chat ${chatId}`);
        }
      } catch (error) {
        logError(
          `Error processing signaling message for chat ${chatId}`,
          error
        );
      }
    };

    // Now set up peer connection event handlers with WebSocket ready
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        if (signalingWs.readyState === WebSocket.OPEN) {
          const candidateData = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };

          signalingWs.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: candidateData,
            })
          );

          logInfo(`Sent ICE candidate for chat ${chatId}`, {
            candidate: candidateData.candidate.substring(0, 50) + "...",
            sdpMid: candidateData.sdpMid,
            sdpMLineIndex: candidateData.sdpMLineIndex,
          });
        } else {
          // Buffer candidates if WebSocket is not ready yet
          iceCandidatesBuffer.push(event.candidate);
          logInfo(
            `Buffered ICE candidate for chat ${chatId} (WebSocket not ready)`
          );
        }
      }
    };

    // Send buffered candidates when WebSocket becomes ready
    if (
      signalingWs.readyState === WebSocket.OPEN &&
      iceCandidatesBuffer.length > 0
    ) {
      for (const candidate of iceCandidatesBuffer) {
        const candidateData = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
        };

        signalingWs.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: candidateData,
          })
        );

        logInfo(`Sent buffered ICE candidate for chat ${chatId}`);
      }
      iceCandidatesBuffer = [];
    }

    peerConnection.oniceconnectionstatechange = () => {
      logInfo(
        `WebRTC ICE connection state: ${peerConnection.iceConnectionState} for chat ${chatId}`
      );

      if (peerConnection.iceConnectionState === "connected") {
        connectionEstablished = true;
        window.dispatchEvent(
          new CustomEvent("webrtcAudioStarted", { detail: { chatId } })
        );
        logInfo(`WebRTC audio streaming started for chat ${chatId}`);
      } else if (peerConnection.iceConnectionState === "disconnected") {
        if (connectionEstablished) {
          window.dispatchEvent(
            new CustomEvent("webrtcAudioStopped", { detail: { chatId } })
          );
          logInfo(`WebRTC audio streaming stopped for chat ${chatId}`);
        }
      } else if (peerConnection.iceConnectionState === "failed") {
        window.dispatchEvent(
          new CustomEvent("webrtcConnectionFailed", { detail: { chatId } })
        );
        logError(`WebRTC connection failed for chat ${chatId}`);
        // Clean up on failure
        stopRtcAudio(chatId);
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      logInfo(
        `WebRTC ICE gathering state: ${peerConnection.iceGatheringState} for chat ${chatId}`
      );
    };

    peerConnection.onconnectionstatechange = () => {
      logInfo(
        `WebRTC connection state: ${peerConnection.connectionState} for chat ${chatId}`
      );

      if (peerConnection.connectionState === "closed") {
        logInfo(`WebRTC connection closed for chat ${chatId}`);
        // Clean up when connection is closed
        activeConnections.delete(chatId);
      } else if (peerConnection.connectionState === "failed") {
        logError(`WebRTC connection failed for chat ${chatId}`);
        stopRtcAudio(chatId);
      }
    };

    // Add audio track to peer connection
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      peerConnection.addTrack(audioTrack, stream);
      logInfo(`Added audio track to peer connection for chat ${chatId}`, {
        trackId: audioTrack.id,
        trackLabel: audioTrack.label,
        trackEnabled: audioTrack.enabled,
        trackReadyState: audioTrack.readyState,
      });
    }

    // Dispatch early setup complete event for immediate UI feedback
    window.dispatchEvent(
      new CustomEvent("webrtcSetupStarted", { detail: { chatId } })
    );

    // Create and send offer
    logInfo(`Creating offer for chat ${chatId}`);
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    await peerConnection.setLocalDescription(offer);
    logInfo(`Set local description for chat ${chatId}`);

    const offerData: RTCOffer = {
      sdp: offer.sdp!,
      type: offer.type,
      chat_id: chatId,
    };

    const response = await fetch(`${getApiUrl()}/rtc/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(offerData),
    });

    if (!response.ok) {
      throw new Error(`Failed to send offer: ${response.statusText}`);
    }

    const answer: RTCAnswer = await response.json();
    logInfo(`Received answer for chat ${chatId}`);

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        sdp: answer.sdp,
        type: answer.type as RTCSdpType,
      })
    );

    logInfo(`WebRTC connection setup completed for chat ${chatId}`);
  } catch (error) {
    logError(`Error starting WebRTC audio for chat ${chatId}`, error);

    // Clean up on error
    await stopRtcAudio(chatId);

    // Dispatch error event
    window.dispatchEvent(
      new CustomEvent("webrtcAudioError", {
        detail: {
          chatId,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    );

    throw error;
  }
}

/**
 * Stop WebRTC audio streaming for a chat
 */
export async function stopRtcAudio(chatId: string): Promise<void> {
  try {
    logInfo(`Stopping WebRTC audio for chat ${chatId}`);

    // Close signaling WebSocket (this will trigger cleanup of ping interval)
    const signalingWs = activeSignalingWs.get(chatId);
    if (signalingWs) {
      if (signalingWs.readyState === WebSocket.OPEN) {
        signalingWs.close(1000, "Normal closure");
      }
      activeSignalingWs.delete(chatId);
    }

    // Close peer connection
    const peerConnection = activeConnections.get(chatId);
    if (peerConnection) {
      // Close all transceivers first
      peerConnection.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });

      peerConnection.close();
      activeConnections.delete(chatId);
    }

    // Stop media stream
    const stream = activeStreams.get(chatId);
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      activeStreams.delete(chatId);
    }

    // Dispatch stopped event
    window.dispatchEvent(
      new CustomEvent("webrtcAudioStopped", { detail: { chatId } })
    );

    logInfo(`WebRTC audio streaming stopped for chat ${chatId}`);
  } catch (error) {
    logError(`Error stopping WebRTC audio for chat ${chatId}`, error);
  }
}

/**
 * Check if WebRTC audio is currently active for a chat
 */
export function isRtcAudioActive(chatId: string): boolean {
  const peerConnection = activeConnections.get(chatId);
  return (
    peerConnection?.iceConnectionState === "connected" ||
    peerConnection?.iceConnectionState === "checking"
  );
}

/**
 * Get the current WebRTC connection state for a chat
 */
export function getRtcConnectionState(
  chatId: string
): RTCPeerConnectionState | null {
  const peerConnection = activeConnections.get(chatId);
  return peerConnection?.connectionState || null;
}

/**
 * Check if the browser supports WebRTC
 */
export function isWebRtcSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    window.RTCPeerConnection
  );
}
