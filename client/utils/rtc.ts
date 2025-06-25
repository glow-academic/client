/**
 * client/utils/rtc.ts
 */

import { getApiUrl } from "@/lib/utils";
import { logError, logInfo } from "./logger";

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

// Global state for WebRTC connections
const peerConnections = new Map<string, RTCPeerConnection>();
const signalingWebSockets = new Map<string, WebSocket>();

const fetchIce = async (): Promise<IceConfig> => {
  return fetch(`${getApiUrl()}/rtc/ice`).then<IceConfig>((r) => r.json());
};

/**
 * Start WebRTC audio streaming for a chat
 */
export async function startRtcAudio(chatId: string): Promise<void> {
  try {
    logInfo("Starting WebRTC audio for chat", { chatId });

    // Clean up any existing connection for this chat
    await stopRtcAudio(chatId);

    // Get ICE servers configuration
    const iceConfig = await fetchIce();

    // Create peer connection with proper ICE servers format
    const iceServers: RTCIceServer[] = [
      // Add fallback STUN servers
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    // Add TURN server if credentials are available
    if (iceConfig.username && iceConfig.credential) {
      iceServers.unshift({
        urls: iceConfig.urls,
        username: iceConfig.username,
        credential: iceConfig.credential,
      });
    } else {
      // Add as STUN-only if no credentials
      iceServers.unshift({ urls: iceConfig.urls });
    }

    const pc = new RTCPeerConnection({ iceServers });

    // Store the peer connection
    peerConnections.set(chatId, pc);

    // Set up signaling WebSocket with proper timing
    const signalingWs = new WebSocket(`${getApiUrl()}/rtc/signaling/${chatId}`);

    // Listen for server ICE candidates
    signalingWs.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);

      if (msg.type === "ice-candidate" && msg.candidate) {
        logInfo(`Received ICE candidate from server for chat ${chatId}`, {
          candidate: msg.candidate.candidate?.substring(0, 50) + "...",
          sdpMid: msg.candidate.sdpMid,
          sdpMLineIndex: msg.candidate.sdpMLineIndex,
        });

        pc.addIceCandidate(msg.candidate)
          .then(() => {
            logInfo(
              `Successfully added remote ICE candidate for chat ${chatId}`
            );
          })
          .catch((e) => {
            logError("Failed to add remote ICE candidate", e);
          });
      } else if (msg.type === "error") {
        logError("WebSocket signaling error:", msg.message);
      }
    };

    signalingWs.onopen = () => {
      logInfo(`WebSocket signaling connected for chat ${chatId}`);
    };

    signalingWs.onerror = (error) => {
      logError("WebSocket signaling error:", error);
    };

    signalingWebSockets.set(chatId, signalingWs);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingWs.readyState === WebSocket.OPEN) {
        logInfo(`Sending ICE candidate for chat ${chatId}`, {
          candidate: event.candidate.candidate.substring(0, 50) + "...",
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });

        signalingWs.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            },
          })
        );
      } else if (event.candidate) {
        logError(
          `Cannot send ICE candidate - WebSocket not ready. State: ${signalingWs.readyState}`
        );
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      logInfo(
        `WebRTC connection state: ${pc.connectionState} for chat ${chatId}`
      );

      if (pc.connectionState === "connected") {
        logInfo(
          `WebRTC connection established successfully for chat ${chatId}`
        );
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        logError(`WebRTC connection ${pc.connectionState} for chat ${chatId}`);
        // Optionally emit an event for the UI to handle
        window.dispatchEvent(
          new CustomEvent("webrtcConnectionFailed", { detail: { chatId } })
        );
      } else if (pc.connectionState === "closed") {
        logInfo(`WebRTC connection closed for chat ${chatId}`);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      logInfo(
        `WebRTC ICE connection state: ${pc.iceConnectionState} for chat ${chatId}`
      );
    };

    // Handle ICE gathering state changes
    pc.onicegatheringstatechange = () => {
      logInfo(
        `WebRTC ICE gathering state: ${pc.iceGatheringState} for chat ${chatId}`
      );
    };

    // Get user media (audio only)
    logInfo(`Requesting user media for chat ${chatId}`);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000, // Optimal for Whisper
      },
    });

    logInfo(`Got user media stream for chat ${chatId}`, {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });

    // Add audio track to peer connection
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      pc.addTrack(audioTrack, stream);
      logInfo(`Added audio track to peer connection for chat ${chatId}`, {
        trackId: audioTrack.id,
        trackLabel: audioTrack.label,
        trackEnabled: audioTrack.enabled,
        trackReadyState: audioTrack.readyState,
      });

      // Monitor track state
      audioTrack.onended = () => {
        logInfo(`Audio track ended for chat ${chatId}`);
      };

      audioTrack.onmute = () => {
        logInfo(`Audio track muted for chat ${chatId}`);
      };

      audioTrack.onunmute = () => {
        logInfo(`Audio track unmuted for chat ${chatId}`);
      };
    } else {
      throw new Error("No audio track available");
    }

    // Create and send offer
    const offer = await pc.createOffer({
      offerToReceiveAudio: false, // We're only sending audio
      offerToReceiveVideo: false,
    });

    await pc.setLocalDescription(offer);

    // Send offer to server
    const response = await fetch(`${getApiUrl()}/rtc/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sdp: offer.sdp,
        type: offer.type,
        chat_id: chatId,
      } as RTCOffer),
    });

    if (!response.ok) {
      throw new Error(`Failed to send offer: ${response.statusText}`);
    }

    const answer: RTCAnswer = await response.json();

    // Set remote description with the answer
    await pc.setRemoteDescription(
      new RTCSessionDescription({
        type: answer.type as RTCSdpType,
        sdp: answer.sdp,
      })
    );

    // Wait for signaling WebSocket to be ready before proceeding
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket signaling connection timeout"));
      }, 5000);

      if (signalingWs.readyState === WebSocket.OPEN) {
        clearTimeout(timeout);
        resolve();
      } else {
        signalingWs.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        signalingWs.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocket signaling connection failed"));
        };
      }
    });

    logInfo(`WebRTC audio streaming started for chat ${chatId}`);

    // Emit success event
    window.dispatchEvent(
      new CustomEvent("webrtcAudioStarted", { detail: { chatId } })
    );
  } catch (error) {
    logError("Failed to start WebRTC audio:", error);

    // Clean up on error
    await stopRtcAudio(chatId);

    // Emit error event
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
    // Close peer connection
    const pc = peerConnections.get(chatId);
    if (pc) {
      // Stop all tracks
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pc.close();
      peerConnections.delete(chatId);
    }

    // Close signaling WebSocket
    const signalingWs = signalingWebSockets.get(chatId);
    if (signalingWs) {
      signalingWs.close();
      signalingWebSockets.delete(chatId);
    }

    logInfo(`WebRTC audio streaming stopped for chat ${chatId}`);

    // Emit stopped event
    window.dispatchEvent(
      new CustomEvent("webrtcAudioStopped", { detail: { chatId } })
    );
  } catch (error) {
    logError("Error stopping WebRTC audio:", error);
  }
}

/**
 * Check if WebRTC audio is currently active for a chat
 */
export function isRtcAudioActive(chatId: string): boolean {
  const pc = peerConnections.get(chatId);
  return pc ? pc.connectionState === "connected" : false;
}

/**
 * Get the current WebRTC connection state for a chat
 */
export function getRtcConnectionState(
  chatId: string
): RTCPeerConnectionState | null {
  const pc = peerConnections.get(chatId);
  return pc ? pc.connectionState : null;
}

/**
 * Check if the browser supports WebRTC
 */
export function isWebRtcSupported(): boolean {
  if (typeof window === "undefined") return false;

  return !!(
    window.RTCPeerConnection &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}
