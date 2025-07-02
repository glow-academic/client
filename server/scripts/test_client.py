# scripts/test_client.py
import asyncio
import json
import logging
import uuid

import pyaudio  # type: ignore
import socketio  # type: ignore
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaStreamTrack
from aiortc.sdp import candidate_from_sdp

# --- Configuration ---
SERVER_URL = "http://localhost:8000"
PROFILE_ID = "965bd24f-dfae-4063-b370-e1373df46322"
SIMULATION_ID = "c5a0b001-aaaa-bbbb-cccc-dddddddddddd"
MESSAGE_TO_SEND = "Hey, how are you?"
# --------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestClient")

sio = socketio.AsyncClient(logger=False, engineio_logger=False)
pc = RTCPeerConnection()

# Global state to hold the chat ID from the server
simulation_chat_id = None

class AudioPlayerTrack(MediaStreamTrack):
    """A media track that receives audio and plays it using PyAudio."""
    kind = "audio"

    def __init__(self, track):
        super().__init__()
        self.track = track
        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=48000,
            output=True,
            frames_per_buffer=960, # 20ms at 48kHz
        )

    async def recv(self):
        frame = await self.track.recv()
        # The frame contains raw audio data, write it directly to the speaker
        self.stream.write(frame.to_ndarray().tobytes())
        return frame

    def stop(self):
        super().stop()
        if self.stream.is_active():
            self.stream.stop_stream()
        self.stream.close()
        self.p.terminate()
        logger.info("PyAudio stream closed.")

@sio.event
async def connect():
    logger.info(f"✅ WebSocket connected: {sio.sid}")
    logger.info("🚀 Starting WebRTC handshake...")
    await sio.emit("webrtc_start", {"profile_id": PROFILE_ID})

@sio.event
async def webrtc_offer(data):
    logger.info("🤝 Received WebRTC offer.")
    offer = RTCSessionDescription(sdp=data["offer"]["sdp"], type=data["offer"]["type"])
    await pc.setRemoteDescription(offer)
    
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    
    logger.info("✅ Sending WebRTC answer...")
    await sio.emit("webrtc_answer", {
        "profile_id": PROFILE_ID,
        "connection_id": data["connection_id"],
        "answer": {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type},
    })

@sio.event
async def webrtc_ice_candidate(data):
    if data.get("candidate"):
        candidate = candidate_from_sdp(data["candidate"]["candidate"])
        candidate.sdpMid = data["candidate"]["sdpMid"]
        candidate.sdpMLineIndex = data["candidate"]["sdpMLineIndex"]
        await pc.addIceCandidate(candidate)

@sio.event
async def webrtc_ready(data):
    logger.info("🎉 WebRTC connection ready! Starting simulation...")
    await sio.emit("start_simulation", {
        "simulation_id": SIMULATION_ID,
        "profile_id": PROFILE_ID,
    })

@sio.event
async def simulation_started(data):
    global simulation_chat_id
    simulation_chat_id = data["chat_id"]
    logger.info(f"🎉 Simulation started! Chat ID: {simulation_chat_id}")
    
    logger.info("💬 Creating data channel...")
    channel = pc.createDataChannel(f"text-{simulation_chat_id}")

    @channel.on("open")
    def on_open():
        logger.info(f"💬 Data channel open. Sending message...")
        payload = json.dumps({
            "chat_id": simulation_chat_id,
            "content": MESSAGE_TO_SEND,
            "assistant_audio_enabled": True,
        })
        channel.send(payload)

@sio.event
def simulation_message_token(data):
    print(data.get("token", ""), end="", flush=True)

@sio.event
def simulation_message_complete(data):
    print("\n✅ Assistant message complete.")

@pc.on("track")
def on_track(track):
    logger.info(f"🔊 Received remote audio track! Starting playback...")
    player = AudioPlayerTrack(track)
    # The player will automatically start consuming frames from the track

async def main():
    try:
        # Add the profile_id to the connection URL as a query parameter
        connection_url = f"{SERVER_URL}?profileId={PROFILE_ID}"
        
        logger.info(f"Connecting to {connection_url}...")
        await sio.connect(
            connection_url,
            socketio_path="/socket.io",
            transports=['websocket'] # Prefer websocket for testing
        )
        await sio.wait()
    except Exception as e:
        logger.error(f"Connection failed: {e}")
    finally:
        if pc.connectionState != "closed":
            await pc.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Manual exit.")