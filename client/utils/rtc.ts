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
    }, 5000);

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

    ws.onclose = () => {
      logInfo(`WebSocket signaling closed for chat ${chatId}`);
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

    // Create signaling WebSocket first (before getUserMedia for faster startup)
    const signalingWsPromise = createSignalingWebSocket(chatId);

    // Request user media
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

    // Wait for signaling WebSocket to be ready
    const signalingWs = await signalingWsPromise;
    activeSignalingWs.set(chatId, signalingWs);

    // Fetch ICE configuration
    const iceConfig = await fetchIce();
    logInfo(`Fetched ICE config`, { urls: iceConfig.urls.length });

    // Create peer connection with ICE servers
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    // Add TURN servers if credentials are provided
    if (iceConfig.username && iceConfig.credential) {
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

    const peerConnection = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10, // Pre-gather candidates
    });

    activeConnections.set(chatId, peerConnection);
    activeStreams.set(chatId, stream);

    // Set up peer connection event handlers
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingWs.readyState === WebSocket.OPEN) {
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

        logInfo(`Sending ICE candidate for chat ${chatId}`, {
          candidate: candidateData.candidate.substring(0, 50) + "...",
          sdpMid: candidateData.sdpMid,
          sdpMLineIndex: candidateData.sdpMLineIndex,
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      logInfo(
        `WebRTC ICE connection state: ${peerConnection.iceConnectionState} for chat ${chatId}`
      );

      if (peerConnection.iceConnectionState === "connected") {
        window.dispatchEvent(
          new CustomEvent("webrtcAudioStarted", { detail: { chatId } })
        );
        logInfo(`WebRTC audio streaming started for chat ${chatId}`);
      } else if (peerConnection.iceConnectionState === "disconnected") {
        window.dispatchEvent(
          new CustomEvent("webrtcAudioStopped", { detail: { chatId } })
        );
        logInfo(`WebRTC audio streaming stopped for chat ${chatId}`);
      } else if (peerConnection.iceConnectionState === "failed") {
        window.dispatchEvent(
          new CustomEvent("webrtcConnectionFailed", { detail: { chatId } })
        );
        logError(`WebRTC connection failed for chat ${chatId}`);
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
    };

    // Handle incoming ICE candidates from server
    signalingWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ice-candidate" && data.candidate) {
          const candidate = new RTCIceCandidate({
            candidate: data.candidate.candidate,
            sdpMid: data.candidate.sdpMid,
            sdpMLineIndex: data.candidate.sdpMLineIndex,
          });

          peerConnection.addIceCandidate(candidate).catch((error) => {
            logError(`Failed to add ICE candidate for chat ${chatId}`, error);
          });

          logInfo(`Received and added ICE candidate for chat ${chatId}`);
        }
      } catch (error) {
        logError(
          `Error processing signaling message for chat ${chatId}`,
          error
        );
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

    // Create and send offer
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    await peerConnection.setLocalDescription(offer);

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

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        sdp: answer.sdp,
        type: answer.type as RTCSdpType,
      })
    );

    logInfo(`WebRTC connection established for chat ${chatId}`);
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

    // Close signaling WebSocket
    const signalingWs = activeSignalingWs.get(chatId);
    if (signalingWs) {
      signalingWs.close();
      activeSignalingWs.delete(chatId);
    }

    // Close peer connection
    const peerConnection = activeConnections.get(chatId);
    if (peerConnection) {
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
