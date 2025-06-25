# app/routes/rtc.py
import asyncio
import json
import logging
import os
import tempfile
import uuid
from typing import Any, Dict, List, Optional

import av  # type: ignore
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
audio_processors: Dict[str, 'AudioProcessor'] = {}

class IceConfig(BaseModel):
    urls: list[str]
    username: str | None = None
    credential: str | None = None

class RTCOffer(BaseModel):
    sdp: str
    type: str
    chat_id: str

class RTCAnswer(BaseModel):
    sdp: str
    type: str

class RTCIceCandidateModel(BaseModel):
    candidate: str
    sdpMLineIndex: int
    sdpMid: str | None = None

class AudioProcessor:
    """
    Audio processor that handles incoming audio stream and processes it with Whisper
    """
    kind = "audio"
    
    def __init__(self, chat_id: str, track: MediaStreamTrack) -> None:
        super().__init__()
        self.chat_id = chat_id
        self.track = track
        self.whisper_model: Any = None
        self.audio_buffer: List[Any] = []
        self.buffer_duration = 0.0
        self.sample_rate = 16000
        self.channels = 1
        self.processing_task: Optional[Any] = None
        
    async def recv(self) -> Any:
        """Receive and process audio frames"""
        frame = await self.track.recv()
        
        # Initialize Whisper model if not done
        if self.whisper_model is None:
            self.whisper_model = model_manager.get_whisper_model()
        
        # Convert to the format Whisper expects (16kHz mono)
        resampler = av.AudioResampler(
            format="s16",
            layout="mono", 
            rate=self.sample_rate
        )
        
        resampled_frame = resampler.resample(frame)
        
        # Add to buffer
        self.audio_buffer.append(resampled_frame)
        self.buffer_duration += resampled_frame.samples / self.sample_rate
        
        # Process buffer when we have enough audio (e.g., 1 second chunks)
        if self.buffer_duration >= 1.0:
            await self._process_audio_buffer()
            
        return frame
    
    async def _process_audio_buffer(self) -> None:
        """Process accumulated audio buffer with Whisper"""
        if not self.audio_buffer:
            return
            
        try:
            # Combine all frames in buffer
            combined_audio = b''
            for frame in self.audio_buffer:
                combined_audio += frame.to_ndarray().tobytes()
            
            # Save to temporary file for Whisper
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                # Write WAV header and audio data
                with av.open(temp_file.name, 'w') as container:
                    stream = container.add_stream('pcm_s16le', rate=self.sample_rate)
                    stream.channels = self.channels
                    
                    # Create frame from combined audio
                    audio_frame = av.AudioFrame.from_ndarray(
                        av.numpy.frombuffer(combined_audio, dtype=av.numpy.int16).reshape(-1, self.channels),
                        format='s16',
                        layout='mono'
                    )
                    audio_frame.sample_rate = self.sample_rate
                    
                    for packet in stream.encode(audio_frame):
                        container.mux(packet)
                
                temp_file_path = temp_file.name
            
            # Transcribe with Whisper
            if self.whisper_model is not None:
                result = self.whisper_model.transcribe(
                    temp_file_path,
                    task='transcribe',
                    fp16=False,  # Use fp32 for better compatibility
                )
                
                transcribed_text = result['text'].strip()
                
                if transcribed_text:
                    logger.info(f"Transcribed audio for chat {self.chat_id}: {transcribed_text[:100]}...")
                    
                    # Process the transcribed message through the simulation pipeline
                    asyncio.create_task(process_simulation_message_websocket(
                        chat_id=self.chat_id,
                        message=transcribed_text,
                        is_audio=True,
                        session=None
                    ))
            
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except OSError:
                pass
                
        except Exception as e:
            logger.error(f"Error processing audio buffer for chat {self.chat_id}: {e}")
        finally:
            # Clear buffer
            self.audio_buffer = []
            self.buffer_duration = 0

@router.get("/ice", response_model=IceConfig)
def ice() -> IceConfig:
    # Public IP or DNS of the TURN server (use your prod hostname later)
    host = os.getenv("TURN_PUBLIC_IP", "localhost")
    realm = os.getenv("TURN_REALM", "example.com")
    user = "webrtc"
    pwd = os.getenv("TURN_PASS", "changeMe")

    return IceConfig(
        urls=[
            f"stun:{host}:3478",
            f"turn:{host}:3478?transport=udp",
            f"turn:{host}:3478?transport=tcp",
        ],
        username=f"{user}",
        credential=pwd,
    )

@router.post("/offer")
async def handle_offer(offer: RTCOffer) -> RTCAnswer:
    """Handle WebRTC offer and return answer"""
    try:
        # Validate chat exists
        db_session = next(get_session())
        try:
            chat = db_session.exec(
                select(SimulationChats).where(SimulationChats.id == offer.chat_id)
            ).one_or_none()
            if not chat:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            if chat.completed:
                raise HTTPException(status_code=400, detail="Chat is completed")
        finally:
            db_session.close()
        
        # Create peer connection
        pc = RTCPeerConnection()
        connection_id = str(uuid.uuid4())
        peer_connections[connection_id] = pc
        
        # Set up peer connection event handlers
        @pc.on("track")  # type: ignore
        def on_track(track: MediaStreamTrack) -> None:
            logger.info(f"Received {track.kind} track for chat {offer.chat_id}")
            
            if track.kind == "audio":
                # Create audio processor
                processor = AudioProcessor(offer.chat_id, track)
                audio_processors[connection_id] = processor
                
                # Add processor to peer connection (for potential future use)
                pc.addTrack(processor)
        
        @pc.on("connectionstatechange")  # type: ignore
        async def on_connectionstatechange() -> None:
            logger.info(f"Connection state changed to {pc.connectionState}")
            if pc.connectionState == "closed":
                # Clean up
                if connection_id in peer_connections:
                    del peer_connections[connection_id]
                if connection_id in audio_processors:
                    del audio_processors[connection_id]
        
        # Set remote description
        await pc.setRemoteDescription(RTCSessionDescription(
            sdp=offer.sdp,
            type=offer.type
        ))
        
        # Create answer
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        return RTCAnswer(
            sdp=pc.localDescription.sdp,
            type=pc.localDescription.type
        )
        
    except Exception as e:
        logger.error(f"Error handling WebRTC offer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/signaling/{chat_id}")
async def websocket_signaling(websocket: WebSocket, chat_id: str) -> None:
    """WebSocket endpoint for ICE candidate exchange"""
    await websocket.accept()
    logger.info(f"WebSocket signaling connected for chat {chat_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "ice-candidate":
                # Handle ICE candidate
                candidate_data = message["candidate"]
                
                # Find the peer connection for this chat
                # Note: In a production system, you'd want better connection management
                for connection_id, pc in peer_connections.items():
                    try:
                        candidate = RTCIceCandidate(
                            candidate=candidate_data["candidate"],
                            sdpMLineIndex=candidate_data["sdpMLineIndex"],
                            sdpMid=candidate_data.get("sdpMid")
                        )
                        await pc.addIceCandidate(candidate)
                        logger.info(f"Added ICE candidate for connection {connection_id}")
                        break
                    except Exception as e:
                        logger.error(f"Error adding ICE candidate: {e}")
                        continue
                        
    except WebSocketDisconnect:
        logger.info(f"WebSocket signaling disconnected for chat {chat_id}")
    except Exception as e:
        logger.error(f"WebSocket signaling error for chat {chat_id}: {e}")
    finally:
        await websocket.close()
