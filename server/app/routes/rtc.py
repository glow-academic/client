# app/routes/rtc.py
import asyncio
import json
import logging
import os
import tempfile
import uuid
from typing import Any, Dict, List, Optional

import av  # type: ignore
import numpy as np  # NEW: used for ndarray conversion
from aiortc import (MediaStreamTrack, RTCIceCandidate,  # type: ignore
                    RTCPeerConnection, RTCSessionDescription)
from app.config import model_manager
from app.db import get_session
from app.models import SimulationChats
from app.services.agents.collection.simulation import run_simulation_agent
from app.web.simulations import process_simulation_message_websocket
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlmodel import select

logger = logging.getLogger(__name__)
router = APIRouter()

# Store active peer connections
peer_connections: Dict[str, RTCPeerConnection] = {}

class IceConfig(BaseModel):
    urls: List[str]
    username: Optional[str] = None
    credential: Optional[str] = None

class RTCOffer(BaseModel):
    sdp: str
    type: str
    chat_id: str

class RTCAnswer(BaseModel):
    sdp: str
    type: str

class IceCandidate(BaseModel):
    candidate: str
    sdpMLineIndex: Optional[int] = None
    sdpMid: Optional[str] = None

class AudioProcessor(MediaStreamTrack):  # type: ignore
    """
    Audio processor that handles incoming audio stream and processes it with Whisper
    """
    
    kind = "audio"
    
    def __init__(self, chat_id: str, track: MediaStreamTrack) -> None:
        super().__init__()  # initialise parent
        self.source_track = track
        self.chat_id = chat_id
        self.audio_buffer: List[bytes] = []
        self.buffer_duration = 1.0  # Process every 1 second
        self.sample_rate = 16000
        self.channels = 1
        self.last_process_time = 0.0

    async def recv(self) -> Any:  # type: ignore
        """
        Receive and process audio frames
        """
        try:
            frame = await self.source_track.recv()
            
            # Convert frame to bytes and add to buffer
            if hasattr(frame, 'to_ndarray'):
                audio_bytes = frame.to_ndarray().tobytes()
                self.audio_buffer.append(audio_bytes)
                
                logger.debug(f"Added audio frame to buffer: {len(audio_bytes)} bytes, buffer size: {len(self.audio_buffer)}")
                
                # Check if we should process the buffer
                current_time = asyncio.get_event_loop().time()
                if current_time - self.last_process_time >= self.buffer_duration:
                    logger.info(f"Processing audio buffer with {len(self.audio_buffer)} frames after {current_time - self.last_process_time:.2f}s")
                    asyncio.create_task(self._process_audio_buffer())
                    self.last_process_time = current_time
            
            return frame
            
        except Exception as e:
            logger.error(f"Error receiving audio frame: {e}")
            raise

    async def _process_audio_buffer(self) -> None:
        """
        Process accumulated audio buffer with Whisper
        """
        if not self.audio_buffer:
            return
        
        try:
            # Combine all audio data
            combined_audio = b"".join(self.audio_buffer)
            self.audio_buffer.clear()
            
            if len(combined_audio) == 0:
                logger.warning("No audio data to process")
                return
            
            logger.info(f"Processing {len(combined_audio)} bytes of audio data")
            
            # Convert bytes to numpy array
            audio_array = np.frombuffer(combined_audio, dtype=np.int16)
            
            # Ensure we have enough data for processing
            if len(audio_array) < self.sample_rate:  # Less than 1 second
                logger.warning("Not enough audio data for transcription")
                return
            
            # Create AudioFrame correctly
            audio_frame = av.AudioFrame.from_ndarray(
                audio_array.reshape(-1, self.channels),
                format="s16",
                layout="mono"
            )
            audio_frame.sample_rate = self.sample_rate
            
            # Save to temporary file for Whisper processing
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_path = temp_file.name
                
                # Write audio frame to file
                container = av.open(temp_path, mode="w")
                stream = container.add_stream("pcm_s16le", rate=self.sample_rate)
                stream.layout = "mono"
                stream.write(audio_frame)
                container.close()
                
                logger.info(f"Saved audio to temporary file: {temp_path}")
                
                # Process with Whisper
                transcription = await self._transcribe_audio(temp_path)
                
                # Clean up temporary file
                os.unlink(temp_path)
                
                if transcription and transcription.strip():
                    logger.info(f"Transcription successful: {transcription[:100]}...")
                    await self._send_transcription(transcription)
                else:
                    logger.warning("No transcription result or empty transcription")
                    
        except Exception as e:
            logger.error(f"Error processing audio buffer: {e}", exc_info=True)

    async def _transcribe_audio(self, audio_path: str) -> Optional[str]:
        """
        Transcribe audio using Whisper
        """
        try:
            whisper_model = model_manager.get_whisper_model()
            result = whisper_model.transcribe(audio_path)
            text = result.get("text", "")
            return text.strip() if isinstance(text, str) else None
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return None

    async def _send_transcription(self, text: str) -> None:
        """
        Send transcribed text as a simulation message
        """
        try:
            # Use the correct function signature for process_simulation_message_websocket
            await process_simulation_message_websocket(
                chat_id=self.chat_id,
                message=text,
                is_audio=True,
                audio_data=None,
                session=None
            )
            
            logger.info(f"Processed WebRTC transcription for chat {self.chat_id}: {text[:50]}...")
                
        except Exception as e:
            logger.error(f"Error sending transcription: {e}")

@router.get("/ice", response_model=IceConfig)
def ice() -> IceConfig:
    """
    Get ICE server configuration for WebRTC
    """
    host = os.getenv("TURN_PUBLIC_IP", "localhost")
    realm = os.getenv("TURN_REALM", "example.com")
    user = os.getenv("TURN_USERNAME", "webrtc")  # Use env var instead of hardcoding
    pwd = os.getenv("TURN_PASS", "changeMe")

    return IceConfig(
        urls=[
            f"stun:{host}:3478",
            f"turn:{host}:3478?transport=udp",
            f"turn:{host}:3478?transport=tcp",
        ],
        username=user,
        credential=pwd,
    )

@router.post("/offer", response_model=RTCAnswer)
async def handle_offer(offer: RTCOffer) -> RTCAnswer:
    """
    Handle WebRTC offer and return answer
    """
    try:
        # Create peer connection
        pc = RTCPeerConnection()
        peer_connections[offer.chat_id] = pc
        
        # Set remote description
        await pc.setRemoteDescription(RTCSessionDescription(
            sdp=offer.sdp,
            type=offer.type
        ))
        
        # Set up peer connection event handlers
        @pc.on("track")  # type: ignore
        def on_track(track: MediaStreamTrack) -> None:
            logger.info(f"Received {track.kind} track for chat {offer.chat_id}")
            
            if track.kind == "audio":
                # Create audio processor
                processor = AudioProcessor(offer.chat_id, track)
                # Don't add the processor as a track - it's just for processing
                logger.info(f"Created audio processor for chat {offer.chat_id}")
        
        @pc.on("connectionstatechange")  # type: ignore
        async def on_connectionstatechange() -> None:
            logger.info(f"Connection state changed to {pc.connectionState}")
            
            if pc.connectionState in ["failed", "closed"]:
                # Clean up peer connection
                if offer.chat_id in peer_connections:
                    del peer_connections[offer.chat_id]
        
        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        return RTCAnswer(
            sdp=answer.sdp,
            type=answer.type
        )
        
    except Exception as e:
        logger.error(f"Error handling WebRTC offer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/signaling/{chat_id}")
async def websocket_signaling(websocket: WebSocket, chat_id: str) -> None:
    """
    WebSocket endpoint for ICE candidate signaling
    """
    await websocket.accept()
    logger.info(f"WebSocket signaling connected for chat {chat_id}")
    
    try:
        # Wait for peer connection to be created
        pc = None
        for _ in range(50):  # Wait up to 5 seconds for peer connection
            pc = peer_connections.get(chat_id)
            if pc:
                break
            await asyncio.sleep(0.1)
        
        if not pc:
            logger.error(f"No peer connection found for chat {chat_id} after waiting")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "No peer connection found for this chat"
            }))
            return
        
        logger.info(f"Found peer connection for chat {chat_id}, setting up ICE candidate handling")
        
        # --- Trickle-ICE back to the browser -------------------------------
        @pc.on("icecandidate")  # type: ignore
        async def on_icecandidate(candidate: RTCIceCandidate) -> None:
            if candidate and websocket.client_state.name == "CONNECTED":
                try:
                    await websocket.send_text(json.dumps({
                        "type": "ice-candidate",
                        "candidate": {
                            "candidate": candidate.candidate,
                            "sdpMid": candidate.sdpMid,
                            "sdpMLineIndex": candidate.sdpMLineIndex,
                        },
                    }))
                    logger.info(f"Sent ICE candidate to client for chat {chat_id}")
                except Exception as e:
                    logger.error(f"Error sending ICE candidate: {e}")
        
        # Handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ice-candidate":
                    candidate_data = message.get("candidate")
                    if candidate_data:
                        # Fix RTCIceCandidate constructor - aiortc expects positional args
                        candidate = RTCIceCandidate(
                            candidate_data.get("candidate"),
                            candidate_data.get("sdpMid"),
                            candidate_data.get("sdpMLineIndex")
                        )
                        await pc.addIceCandidate(candidate)
                        logger.info(f"Added ICE candidate for chat {chat_id}")
                        
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for chat {chat_id}")
                break
            except Exception as e:
                logger.error(f"Error in WebSocket signaling: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket signaling error: {e}")
    finally:
        logger.info(f"WebSocket signaling disconnected for chat {chat_id}")
