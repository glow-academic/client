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
from aiortc import (MediaStreamTrack, RTCConfiguration,  # type: ignore
                    RTCIceCandidate, RTCIceServer, RTCPeerConnection,
                    RTCSessionDescription)
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
# NEW: buffer ICE candidates generated before signaling WS is open
candidate_buffers: Dict[str, List[RTCIceCandidate]] = {}

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _build_ice_servers() -> List[Dict[str, Any]]:
    """Return ICE server configuration matching the values returned by `/rtc/ice`.

    Having the server gather TURN / STUN candidates as well greatly increases
    the chance of establishing a successful connection, especially when the
    server itself is running inside Docker or behind NAT.  We construct the
    same list of servers that the `/rtc/ice` endpoint returns so that both the
    browser and the server use a symmetric configuration.
    """

    host = os.getenv("TURN_PUBLIC_IP", "localhost")
    user = os.getenv("TURN_USERNAME")
    pwd = os.getenv("TURN_PASSWORD")

    # Baseline public Google STUN servers + local STUN on the TURN host.
    ice_servers: List[Dict[str, Any]] = [
        {
            "urls": [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                f"stun:{host}:3478",
            ]
        }
    ]

    # Add TURN entries only if credentials are present.
    if user and pwd:
        ice_servers.append(
            {
                "urls": [
                    f"turn:{host}:3478?transport=udp",
                    f"turn:{host}:3478?transport=tcp",
                ],
                "username": user,
                "credential": pwd,
            }
        )

    logger.info(
        "Using ICE servers on server peer-connection: %s",
        ", ".join(
            [url for s in ice_servers for url in (s["urls"] if isinstance(s["urls"], list) else [s["urls"]])]
        ),
    )

    return ice_servers

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
        self.buffer_duration = 0.5  # Process every 0.5 seconds for faster response
        self.sample_rate = 16000
        self.channels = 1
        self.last_process_time = 0.0
        self._processing = False

    async def _start_processing(self) -> None:
        """Start processing audio frames from the source track"""
        if self._processing:
            return
        
        self._processing = True
        logger.info(f"Starting audio processing for chat {self.chat_id}")
        
        try:
            while self._processing:
                try:
                    frame = await self.recv()
                    # Frame processing happens in recv() method
                except Exception as e:
                    logger.error(f"Error in audio processing loop: {e}")
                    break
        except Exception as e:
            logger.error(f"Audio processing stopped for chat {self.chat_id}: {e}")
        finally:
            self._processing = False
            logger.info(f"Audio processing ended for chat {self.chat_id}")

    def stop_processing(self) -> None:
        """Stop processing audio frames"""
        self._processing = False

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
            logger.info(f"Attempting to send transcription for chat {self.chat_id}: '{text[:100]}...' (length: {len(text)})")
            
            # Check if text is meaningful (not just noise/silence)
            if len(text.strip()) < 3:
                logger.warning(f"Transcription too short, skipping: '{text}'")
                return
                
            # Use the correct function signature for process_simulation_message_websocket
            await process_simulation_message_websocket(
                chat_id=self.chat_id,
                message=text,
                is_audio=True,
                audio_data=None,
                session=None
            )
            
            logger.info(f"Successfully processed WebRTC transcription for chat {self.chat_id}: {text[:50]}...")
                
        except Exception as e:
            logger.error(f"Error sending transcription for chat {self.chat_id}: {e}", exc_info=True)

@router.get("/ice", response_model=IceConfig)
def ice() -> IceConfig:
    """
    Get ICE server configuration for WebRTC
    """
    host = os.getenv("TURN_PUBLIC_IP", "localhost")
    realm = os.getenv("TURN_REALM", "localhost")
    user = os.getenv("TURN_USERNAME")
    pwd = os.getenv("TURN_PASSWORD")

    # Create comprehensive STUN/TURN URLs
    urls = [
        # Google STUN servers (fallback)
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        # Local TURN/STUN server
        f"stun:{host}:3478",
    ]
    
    # Add TURN URLs if credentials are available
    if user and pwd:
        urls.extend([
            f"turn:{host}:3478?transport=udp",
            f"turn:{host}:3478?transport=tcp",
        ])
        logger.info(f"ICE configuration: host={host}, realm={realm}, with TURN credentials")
    else:
        logger.info(f"ICE configuration: host={host}, STUN only (no TURN credentials)")

    logger.debug(f"ICE URLs: {urls}")

    return IceConfig(
        urls=urls,
        username=user,
        credential=pwd,
    )

@router.post("/offer", response_model=RTCAnswer)
async def handle_offer(offer: RTCOffer) -> RTCAnswer:
    """
    Handle WebRTC offer and return answer
    """
    try:
        logger.info(f"Handling WebRTC offer for chat {offer.chat_id}")
        
                # Create peer connection _with the same ICE servers that the client uses_.
        # This is critical for reliable NAT traversal when the API server is
        # running inside Docker or behind its own NAT.
        
        # Convert our dict format to aiortc's RTCIceServer objects
        ice_servers_list = []
        for server_config in _build_ice_servers():
            if "username" in server_config and "credential" in server_config:
                ice_servers_list.append(RTCIceServer(
                    urls=server_config["urls"],
                    username=server_config["username"],
                    credential=server_config["credential"]
                ))
            else:
                ice_servers_list.append(RTCIceServer(urls=server_config["urls"]))
        
        config = RTCConfiguration(iceServers=ice_servers_list)
        pc = RTCPeerConnection(configuration=config)
        peer_connections[offer.chat_id] = pc

        # NEW: Prepare candidate buffer for this chat (used by signaling WS)
        candidate_buffers.setdefault(offer.chat_id, [])
        
        # Set remote description
        await pc.setRemoteDescription(RTCSessionDescription(
            sdp=offer.sdp,
            type=offer.type
        ))
        
        # Set up peer connection event handlers
        @pc.on("track")  # type: ignore
        def on_track(track: MediaStreamTrack) -> None:
            logger.info(f"Received {track.kind} track for chat {offer.chat_id} - Track ID: {getattr(track, 'id', 'unknown')}")
            
            if track.kind == "audio":
                try:
                    # Create audio processor
                    processor = AudioProcessor(offer.chat_id, track)
                    # Start processing the track
                    asyncio.create_task(processor._start_processing())
                    logger.info(f"Created and started audio processor for chat {offer.chat_id}")
                except Exception as e:
                    logger.error(f"Error creating audio processor for chat {offer.chat_id}: {e}")
            else:
                logger.warning(f"Received non-audio track ({track.kind}) for chat {offer.chat_id}, ignoring")
        
        @pc.on("connectionstatechange")  # type: ignore
        async def on_connectionstatechange() -> None:
            logger.info(f"Connection state changed to {pc.connectionState} for chat {offer.chat_id}")
            
            if pc.connectionState == "connected":
                logger.info(f"WebRTC connection established successfully for chat {offer.chat_id}")
            elif pc.connectionState == "failed":
                logger.warning(f"WebRTC connection failed for chat {offer.chat_id}, cleaning up")
                # Clean up peer connection
                if offer.chat_id in peer_connections:
                    del peer_connections[offer.chat_id]
            elif pc.connectionState == "disconnected":
                logger.info(f"WebRTC connection disconnected for chat {offer.chat_id}")
                # Don't immediately clean up on disconnect - wait to see if it reconnects
            elif pc.connectionState == "closed":
                logger.info(f"WebRTC connection closed for chat {offer.chat_id}, cleaning up")
                # Clean up peer connection
                if offer.chat_id in peer_connections:
                    del peer_connections[offer.chat_id]
                
        @pc.on("iceconnectionstatechange")  # type: ignore
        async def on_iceconnectionstatechange() -> None:
            logger.info(f"ICE connection state changed to {pc.iceConnectionState} for chat {offer.chat_id}")
            
            if pc.iceConnectionState == "failed":
                logger.warning(f"ICE connection failed for chat {offer.chat_id}")
                # Don't immediately clean up - let connection state handler deal with it
            elif pc.iceConnectionState == "disconnected":
                logger.info(f"ICE connection disconnected for chat {offer.chat_id}")
                # Don't immediately clean up - connection might recover
                
        @pc.on("icegatheringstatechange")  # type: ignore  
        async def on_icegatheringstatechange() -> None:
            logger.info(f"ICE gathering state changed to {pc.iceGatheringState} for chat {offer.chat_id}")
        
        # Register on_icecandidate to buffer candidates
        @pc.on("icecandidate")  # type: ignore
        async def _buffer_icecandidate(candidate: RTCIceCandidate) -> None:
            # candidate can be None when gathering is complete
            if candidate:
                candidate_buffers[offer.chat_id].append(candidate)
                logger.debug(
                    "Buffered ICE candidate for chat %s (total buffered: %d)",
                    offer.chat_id,
                    len(candidate_buffers[offer.chat_id]),
                )
        
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
        # Wait for peer connection to be created with longer timeout
        pc = None
        max_attempts = 100  # Wait up to 10 seconds for peer connection
        for attempt in range(max_attempts):
            pc = peer_connections.get(chat_id)
            if pc:
                logger.info(f"Found peer connection for chat {chat_id} after {attempt * 0.1:.1f}s")
                break
            await asyncio.sleep(0.1)
        
        if not pc:
            logger.error(f"No peer connection found for chat {chat_id} after waiting {max_attempts * 0.1}s")
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "No peer connection found for this chat"
            }))
            return
        
        logger.info(f"Found peer connection for chat {chat_id}, setting up ICE candidate handling")
        
        # Track if we've sent any ICE candidates
        candidates_sent = 0
        candidates_received = 0
        
        # ------------------------------------------------------------------
        # Send any candidates that were generated *before* the WebSocket
        # connection was established.
        # ------------------------------------------------------------------
        initial_buffer = candidate_buffers.get(chat_id, [])
        for cand in initial_buffer:
            await websocket.send_text(json.dumps({
                "type": "ice-candidate",
                "candidate": {
                    "candidate": str(cand),
                    "sdpMid": cand.sdpMid,
                    "sdpMLineIndex": cand.sdpMLineIndex,
                },
            }))
            candidates_sent += 1
        # Clear buffer once sent
        if chat_id in candidate_buffers:
            candidate_buffers[chat_id].clear()
        
        # --- Trickle-ICE back to the browser -------------------------------
        @pc.on("icecandidate")  # type: ignore
        async def on_icecandidate(candidate: RTCIceCandidate) -> None:
            nonlocal candidates_sent
            if candidate and websocket.client_state.name == "CONNECTED":
                try:
                    # Convert RTCIceCandidate to proper format for browser
                    candidate_dict = {
                        "candidate": str(candidate),  # This gives the full candidate string
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                    }
                    
                    await websocket.send_text(json.dumps({
                        "type": "ice-candidate",
                        "candidate": candidate_dict,
                    }))
                    candidates_sent += 1
                    logger.info(f"Sent ICE candidate #{candidates_sent} to client for chat {chat_id}: {candidate_dict['candidate'][:50]}...")
                except Exception as e:
                    logger.error(f"Error sending ICE candidate: {e}")
        
        # Send initial status message
        await websocket.send_text(json.dumps({
            "type": "signaling_ready",
            "message": f"Signaling ready for chat {chat_id}"
        }))
        
        # Keep connection alive and handle incoming messages
        connection_active = True
        while connection_active:
            try:
                # Use a timeout to periodically check connection state
                data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                message = json.loads(data)
                
                if message.get("type") == "ice-candidate":
                    candidate_data = message.get("candidate")
                    if candidate_data and candidate_data.get("candidate"):
                        try:
                            # Parse the candidate string to extract required fields
                            candidate_str = candidate_data.get("candidate")
                            logger.debug(f"Processing ICE candidate: {candidate_str}")
                            
                            # Parse candidate string to extract required fields
                            # Format: "candidate:foundation component protocol priority ip port typ type [raddr related_address] [rport related_port] [extension-att-name extension-att-value]*"
                            parts = candidate_str.split()
                            if len(parts) < 8:
                                logger.error(f"Invalid candidate format: {candidate_str}")
                                continue
                                
                            # Extract required fields from candidate string
                            foundation = parts[0].split(':')[1]  # Remove "candidate:" prefix
                            component = int(parts[1])
                            protocol = parts[2]
                            priority = int(parts[3])
                            ip = parts[4]
                            port = int(parts[5])
                            
                            # Find the "typ" keyword and get the candidate type
                            if "typ" not in parts:
                                logger.error(f"No 'typ' found in candidate: {candidate_str}")
                                continue
                            typ_index = parts.index("typ")
                            candidate_type = parts[typ_index + 1]
                            
                            # Handle related address and port for relay candidates
                            related_address = None
                            related_port = None
                            if "raddr" in parts:
                                raddr_index = parts.index("raddr")
                                if raddr_index + 1 < len(parts):
                                    related_address = parts[raddr_index + 1]
                            if "rport" in parts:
                                rport_index = parts.index("rport")
                                if rport_index + 1 < len(parts):
                                    related_port = int(parts[rport_index + 1])
                            
                            # Create RTCIceCandidate with proper constructor
                            candidate = RTCIceCandidate(
                                component=component,
                                foundation=foundation,
                                ip=ip,
                                port=port,
                                priority=priority,
                                protocol=protocol,
                                type=candidate_type,
                                relatedAddress=related_address,
                                relatedPort=related_port,
                                sdpMid=candidate_data.get("sdpMid"),
                                sdpMLineIndex=candidate_data.get("sdpMLineIndex")
                            )
                            
                            await pc.addIceCandidate(candidate)
                            candidates_received += 1
                            logger.info(f"Added ICE candidate #{candidates_received} for chat {chat_id}: {candidate_type} {ip}:{port}")
                        except ValueError as e:
                            logger.error(f"Failed to parse ICE candidate values: {e}")
                            logger.debug(f"Candidate string: {candidate_str}")
                        except Exception as e:
                            logger.error(f"Failed to add ICE candidate: {e}")
                            logger.debug(f"Candidate data: {candidate_data}")
                            logger.debug(f"Candidate string: {candidate_str}")
                elif message.get("type") == "ping":
                    # Respond to ping to keep connection alive
                    await websocket.send_text(json.dumps({"type": "pong"}))
                        
            except asyncio.TimeoutError:
                # Check if peer connection is still active
                if chat_id not in peer_connections:
                    logger.info(f"Peer connection removed for chat {chat_id}, closing signaling")
                    connection_active = False
                    break
                # Continue waiting for messages
                continue
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for chat {chat_id}")
                connection_active = False
                break
            except Exception as e:
                logger.error(f"Error in WebSocket signaling: {e}")
                connection_active = False
                break
                
        logger.info(f"WebSocket signaling session ended for chat {chat_id} - sent {candidates_sent} candidates, received {candidates_received} candidates")
                
    except Exception as e:
        logger.error(f"WebSocket signaling error: {e}")
    finally:
        logger.info(f"WebSocket signaling disconnected for chat {chat_id}")
        # Don't clean up peer connection here - let the main connection handler do it
