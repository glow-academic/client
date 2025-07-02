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

# AudioPlayerTrack class removed - no longer needed

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

playback_done = asyncio.Event() 

@pc.on("track")
def on_track(track):
    logger.info("🔊 Remote audio track received – starting playback …")

    async def play_audio():
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=48000,
            output=True,
            frames_per_buffer=960  # 20ms at 48kHz
        )
        try:
            while True:
                frame = await track.recv()
                stream.write(frame.to_ndarray().tobytes())
        except (asyncio.CancelledError, Exception):
            # Handle both cancellation and MediaStreamError when track ends
            pass
        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()
            logger.info("🔇 Audio playback stopped.")
            playback_done.set()

    asyncio.create_task(play_audio())


@sio.event
def simulation_message_complete(data):
    print("\n✅ Assistant message complete.")
    asyncio.create_task(shutdown_after_playback())  # no immediate hang-up

async def shutdown_after_playback():
    await playback_done.wait()          # wait until track really ends
    await asyncio.sleep(0.2)            # let the last packet flush
    await pc.close()
    await sio.disconnect()


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
        await asyncio.wait_for(sio.wait(), timeout=30)
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