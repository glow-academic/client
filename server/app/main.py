# server/app/main.py
import asyncio
import contextlib
import fractions
import json
import logging
import os
import platform
import sys
import time
import uuid
from typing import Any, AsyncIterator, Dict, Generator, List, Optional

import socketio  # type: ignore
# WebRTC imports
from aiortc import (MediaStreamTrack, RTCConfiguration,  # type: ignore
                    RTCIceCandidate, RTCIceServer, RTCPeerConnection,
                    RTCSessionDescription)
from aiortc.sdp import candidate_from_sdp  # type: ignore
from app.db import get_session, init_db
from app.models import SimulationChats
from app.routes.audio import router as audio_router
from app.routes.documents import router as documents_router
from app.routes.scenarios import router as scenarios_router
from app.utils.audio import Modalities
from av import AudioFrame  # type: ignore
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

load_dotenv()

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

client_port = os.getenv("CLIENT_PORT", "3000")

# Allow all origins
allowed_origins = [
    f"http://localhost:{client_port}",
    "https://boilersketch.cs.purdue.edu",
]

# Store active chat connections
active_connections: dict[str, str] = {}

# Global store for all active runs (unified tracking)
active_runs: dict[str, Any] = {}

# Profile-based connection management (one socket + one WebRTC per profile)
profiles: Dict[str, Dict[str, Any]] = {}  # profile_id -> {current_socket, current_connection_id, peer_connection, ice_candidates_buffer}

class ServerAudioStreamTrack(MediaStreamTrack):
    """
    Receives pre-chunked 20ms, 48kHz PCM audio and wraps it in a timed AudioFrame.
    """
    kind = "audio"

    def __init__(self) -> None:
        super().__init__()
        self.queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self._pts = 0
        self._time_base = fractions.Fraction(1, 48000)

    def add_chunk(self, chunk: bytes) -> None:
        """Adds audio chunk(s) to the queue, automatically splitting oversized buffers."""
        frame_size = 960 * 2  # 960 samples × 2 bytes = 1920 bytes per 20ms frame
        
        # Fast path: correctly sized chunk
        if len(chunk) == frame_size:
            self.queue.put_nowait(chunk)
            return
        
        # Handle oversized buffers by splitting them into proper frames
        if len(chunk) > frame_size:
            # Warn about non-multiple remainders that will be truncated
            if len(chunk) % frame_size != 0:
                logger.warning(f"Non-multiple buffer {len(chunk)} bytes – truncating remainder")
            
            # Split into 1920-byte frames
            for i in range(0, len(chunk) - (len(chunk) % frame_size), frame_size):
                self.queue.put_nowait(chunk[i:i + frame_size])
            return
        
        # Handle undersized chunks (shouldn't happen but just in case)
        logger.warning(f"Undersized chunk {len(chunk)} bytes – padding to frame size")
        padded_chunk = chunk + b'\x00' * (frame_size - len(chunk))
        self.queue.put_nowait(padded_chunk)

    def end_stream(self) -> None:
        """Signals the end of the stream by adding a None sentinel."""
        logger.info("Ending persistent server audio stream.")
        self.queue.put_nowait(None)

    async def recv(self) -> AudioFrame:
        """Pulls the next PCM chunk and wraps it in a timed AudioFrame."""
        chunk = await self.queue.get()
        if chunk is None:
            self.stop()
            raise asyncio.CancelledError("Audio stream ended.")

        # Create the AudioFrame directly from the 20ms chunk
        frame = AudioFrame(format="s16", layout="mono", samples=960)
        frame.planes[0].update(chunk)

        # Set the presentation timestamp
        frame.sample_rate = 48000
        frame.pts = self._pts
        frame.time_base = self._time_base
        self._pts += frame.samples
        
        # Add debugging for the first ~2 seconds of frames
        if self._pts < (48000 * 2):
            logger.info(
                f"DEBUG_AUDIO_FRAME: "
                f"pts={frame.pts}, "
                f"samples={frame.samples}, "
                f"sample_rate={frame.sample_rate}, "
                f"time_base={frame.time_base}, "
                f"duration_ms={frame.samples / 48.0:.2f}"
            )
        
        return frame

# Add this helper function to the top of the file
def force_opus_codec(sdp: str) -> str:
    """Manipulates the SDP to prioritize the Opus codec."""
    sdp_lines = sdp.splitlines()
    opus_payload_type = None
    
    # Find the payload type for Opus
    for line in sdp_lines:
        if "rtpmap" in line and "opus/48000" in line:
            try:
                # Example: a=rtpmap:96 opus/48000/2
                opus_payload_type = line.split(":")[1].split(" ")[0]
                break
            except IndexError:
                continue
                
    if opus_payload_type:
        logger.info(f"Found Opus codec with payload type: {opus_payload_type}")
        new_sdp_lines = []
        for line in sdp_lines:
            # Rebuild the m=audio line to only include Opus
            if line.startswith("m=audio"):
                parts = line.split(" ")
                # Example becomes: m=audio 9 UDP/TLS/RTP/SAVPF 96
                new_line = " ".join(parts[:3] + [opus_payload_type])
                new_sdp_lines.append(new_line)
                logger.info(f"Rewriting m=audio line to: {new_line}")
            else:
                new_sdp_lines.append(line)
        return "\r\n".join(new_sdp_lines)

    logger.warning("Opus codec not found in offer, cannot force it.")
    return sdp

def _get_public_ip() -> str:
    """Get public IP address for TURN server configuration."""
    import socket
    import urllib.request

    # Try multiple methods to get public IP
    methods = [
        "https://ifconfig.me/ip",
        "https://ipinfo.io/ip", 
        "https://icanhazip.com",
    ]
    
    for url in methods:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                ip = response.read().decode('utf-8').strip()
                # Validate IP format
                socket.inet_aton(ip)
                return str(ip)
        except Exception:
            continue
    
    # Fallback to localhost for local development
    return "127.0.0.1"

def _build_ice_servers() -> List[Dict[str, Any]]:
    """Return ICE server configuration for WebRTC connections."""
    # First, try to use the URIs directly if they're set (from setup.sh)
    turn_uri = os.getenv("TURN_URI")
    stun_uri = os.getenv("STUN_URI")
    
    if turn_uri and stun_uri:
        # Use the URIs directly from environment (setup.sh sets these)
        user = os.getenv("TURN_USERNAME")
        pwd = os.getenv("TURN_PASSWORD")
        
        ice_servers: List[Dict[str, Any]] = [
            {
                "urls": [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    stun_uri,
                ]
            }
        ]
        
        if user and pwd:
            ice_servers.append(
                {
                    "urls": [turn_uri],
                    "username": user,
                    "credential": pwd,
                }
            )
        
        logger.info(f"Using ICE configuration from environment variables (TURN_URI/STUN_URI)")
    else:
        # Fallback to building from components
        host = os.getenv("TURN_PUBLIC_IP")
        if not host:
            # Auto-detect public IP
            host = _get_public_ip()
            logger.info(f"Auto-detected public IP: {host}")
        
        user = os.getenv("TURN_USERNAME")
        pwd = os.getenv("TURN_PASSWORD")

        # Baseline public Google STUN servers + local STUN on the TURN host.
        ice_servers = [
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
        
        logger.info(f"Using ICE configuration built from components (host: {host})")

    logger.info(
        "Using ICE servers for WebRTC: %s",
        ", ".join(
            [url for s in ice_servers for url in (s["urls"] if isinstance(s["urls"], list) else [s["urls"]])]
        ),
    )

    return ice_servers

async def cleanup_profile_connection(profile_id: str, reason: str = "cleanup") -> None:
    """Clean up all connections for a profile."""
    logger.info(f"Cleaning up profile {profile_id} connections - {reason}")
    
    if profile_id not in profiles:
        return
        
    profile_data = profiles.pop(profile_id, None)  # Atomically get and remove
    if not profile_data:
        return

    # End server audio track if one exists (only when connection is being cleaned up)
    server_audio_track = profile_data.get("server_audio_track")
    if server_audio_track:
        try:
            server_audio_track.end_stream()
            logger.info(f"Ended persistent server audio track for profile {profile_id}")
        except Exception as e:
            logger.error(f"Error ending server audio track for profile {profile_id}: {e}")

    # Close peer connection
    pc = profile_data.get("peer_connection")
    if pc and pc.connectionState != "closed":
        try:
            # Give a moment for tasks to wrap up before closing
            await asyncio.sleep(0.1)  # Small delay to prevent race conditions
            await pc.close()
            logger.info(f"Closed peer connection for profile {profile_id}")
        except Exception as e:
            logger.error(f"Error closing peer connection for profile {profile_id}: {e}")

async def create_webrtc_peer_connection(profile_id: str, connection_id: str) -> RTCPeerConnection:
    """Create a new WebRTC peer connection for a profile with connection ID."""
    logger.info(f"Creating WebRTC peer connection for profile {profile_id}, connection {connection_id}")
    
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
    
    # SPEC CHANGE: Create and store a persistent audio track upfront
    server_audio_track = ServerAudioStreamTrack()
    
    # Store the peer connection object immediately
    if profile_id not in profiles:
        profiles[profile_id] = {}
    
    profiles[profile_id].update({
        "peer_connection": pc,
        "current_connection_id": connection_id,
        "data_channels": {},
        "ice_candidates_buffer": [],
        "server_audio_track": server_audio_track  # Store the persistent track
    })
    
    # Add the persistent track to the peer connection immediately
    pc.addTrack(server_audio_track)
    logger.info(f"Added persistent audio track to peer connection for profile {profile_id}")

    # SPEC CHANGE: Use a separate transceiver for receiving user audio to avoid duplicate tracks
    # This creates one track for receiving user's mic and one for sending server's TTS
    pc.addTransceiver("audio", direction="recvonly")  # For receiving user's mic audio
    
    logger.info(f"WebRTC peer connection setup complete for profile {profile_id}: 1 outgoing audio track, 1 incoming audio track")

    # ---- ensure at least one negotiated data channel so the initial SDP has an m-section ----
    signalling_dc = pc.createDataChannel("signalling")  # name arbitrary but consistent

    @signalling_dc.on("open")  # type: ignore
    def _() -> None:
        logger.info(f"Signalling data channel open for profile {profile_id}, connection {connection_id}")
    # ------------------------------------------------------------------------------------------
    
    # Set up peer connection event handlers
    @pc.on("connectionstatechange")  # type: ignore
    async def on_connectionstatechange() -> None:
        logger.info(f"WebRTC connection state changed to {pc.connectionState} for profile {profile_id}, connection {connection_id}")
        
        # Only emit if this is still the current connection
        if profile_id in profiles and profiles[profile_id].get("current_connection_id") == connection_id:
            await sio.emit('webrtc_connection_state', {
                'profile_id': profile_id,
                'connection_id': connection_id,
                'state': pc.connectionState
            }, room=profile_id)
            
            if pc.connectionState == "failed" or pc.connectionState == "closed":
                # Clean up on failure/closure
                await cleanup_profile_connection(profile_id, f"connection state {pc.connectionState}")
    
    @pc.on("iceconnectionstatechange")  # type: ignore
    async def on_iceconnectionstatechange() -> None:
        logger.info(f"WebRTC ICE connection state changed to {pc.iceConnectionState} for profile {profile_id}, connection {connection_id}")
        
        # Only emit if this is still the current connection
        if profile_id in profiles and profiles[profile_id].get("current_connection_id") == connection_id:
            await sio.emit('webrtc_ice_state', {
                'profile_id': profile_id,
                'connection_id': connection_id,
                'state': pc.iceConnectionState
            }, room=profile_id)
    
    @pc.on("icecandidate")  # type: ignore
    async def on_icecandidate(candidate: RTCIceCandidate | None) -> None:
        # Only emit if this is still the current connection
        if profile_id in profiles and profiles[profile_id].get("current_connection_id") == connection_id:
            await sio.emit(
                "webrtc_ice_candidate",
                {
                    "profile_id": profile_id,
                    "connection_id": connection_id,
                    "candidate": {
                        "candidate": str(candidate),
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                    } if candidate else None,      # <-- None when gathering is done
                },
                room=profile_id,
            )
            
    @pc.on("track")
    async def on_track(track: Any) -> None:
        logger.info(f"Received track: {track.kind} for profile {profile_id}, connection {connection_id}")
        if track.kind == "audio":
            chat_id = getattr(pc, "_last_chat_id", None)
            # MODIFIED: Get the stored audio preference
            assistant_audio_enabled = getattr(pc, "_assistant_audio_enabled", True)

            if chat_id:
                from app.web.simulations import process_audio_stream

                # MODIFIED: Pass the preference down to the processing function
                asyncio.create_task(
                    process_audio_stream(track, chat_id, profile_id, assistant_audio_enabled)
                )
            else:
                logger.warning(
                    f"Received audio track for profile {profile_id} but no chat_id was associated."
                )

    @pc.on("datachannel")  # type: ignore
    def on_datachannel(channel: Any) -> None:
        logger.info(f"Received data channel: {channel.label} for profile {profile_id}, connection {connection_id}")
        if profile_id in profiles and profiles[profile_id].get("current_connection_id") == connection_id:
            profiles[profile_id]["data_channels"][channel.label] = channel
            
            @channel.on("message")  # type: ignore
            def on_message(message: Any) -> None:
                # Handle incoming WebRTC data channel messages
                asyncio.create_task(handle_webrtc_data_message(profile_id, channel.label, message))
    
    return pc

async def handle_webrtc_data_message(profile_id: str, channel_label: str, message: Any) -> None:
    """Handle incoming WebRTC data channel messages."""
    try:
        logger.info(f"Received WebRTC data message on channel {channel_label} for profile {profile_id}")
        
        # Parse the message
        if isinstance(message, bytes):
            # Handle binary data (audio)
            data = json.loads(message.decode('utf-8'))
        else:
            # Handle text data
            data = json.loads(message)
        
        chat_id = data.get('chat_id')
        content = data.get('content', '')
        assistant_audio_enabled = data.get('assistant_audio_enabled', False)  # New field
        
        if not chat_id:
            logger.error(f"No chat_id in WebRTC message: {data}")
            return
        
        # Determine chat type from channel label or chat_id prefix
        if channel_label.startswith('text-'):
            if 'assistant' in chat_id or 'asst' in chat_id:
                chat_type = 'assistant'
            else:
                chat_type = 'simulation'
            
            if chat_type == 'assistant':
                from app.web.assistants import \
                    process_assistant_message_websocket
                await process_assistant_message_websocket(
                    chat_id=uuid.UUID(chat_id),
                    message=content,
                    session=None
                )
            elif chat_type == 'simulation':
                from app.web.simulations import \
                    process_simulation_message_websocket
                await process_simulation_message_websocket(
                    chat_id=chat_id,
                    message=content,
                    profile_id=profile_id,
                    assistant_audio_enabled=assistant_audio_enabled,
                    session=None
                )
            else:
                logger.warning(f"Unknown chat type for WebRTC message: {chat_type}")
                return
        
    except Exception as e:
        logger.error(f"Error handling WebRTC data message: {e}")

# Create Socket.IO server instance globally
sio = socketio.AsyncServer(
    cors_allowed_origins=allowed_origins,
    cors_credentials=True,
    logger=True,  # Enable logging for debugging
    engineio_logger=True,  # Enable engine.io logging
    async_mode='asgi',
    # Explicitly set compatible protocol versions
    transports=['polling', 'websocket'],
    # Allow upgrades from polling to websocket
    allow_upgrades=True,
    # Increase timeouts for better stability
    ping_timeout=60,
    ping_interval=25,
    # Try to support Engine.IO protocol v4
    engineio_options={
        'max_http_buffer_size': 1000000,
        'ping_timeout': 60,
        'ping_interval': 25,
        'compression': False,  # Disable compression for better performance
        'cookie': False,  # Disable cookies for stateless operation
    }
)

from app.web.assistants import register_assistant_events
from app.web.simulations import register_simulation_events

# Register simulation WebSocket events IMMEDIATELY after sio creation
register_simulation_events(sio)

@sio.event  # type: ignore
async def send_simulation_message(sid: str, data: Dict[str, Any]) -> None:
    """Handle simulation message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")
        assistant_audio_enabled = data.get("assistant_audio_enabled", False)

        if not chat_id or not message:
            logger.error(f"Missing chat_id or message in request from {sid}")
            return

        logger.info(f"Processing send_simulation_message from {sid}: {chat_id} (audio: {assistant_audio_enabled})")

        # Process the message via WebSocket
        from app.web.simulations import process_simulation_message_websocket

        await process_simulation_message_websocket(
            chat_id=chat_id, 
            message=message, 
            assistant_audio_enabled=assistant_audio_enabled,
            session=None
        )

    except Exception as e:
        logger.error(f"Error in send_simulation_message for {sid}: {str(e)}")
        await sio.emit(
            "simulation_error",
            {"success": False, "message": str(e)},
            room=sid,
        )

register_assistant_events(sio)

@sio.event  # type: ignore
async def connect(sid: str, environ: Any, auth: Any) -> bool:
    """Handle WebSocket connection with robust, profile-based socket management."""
    query_string = environ.get('QUERY_STRING', '')
    profile_id = None
    if 'profileId=' in query_string:
        try:
            profile_id = query_string.split('profileId=')[1].split('&')[0]
        except IndexError:
            pass

    logger.info(f"Client connecting: sid={sid}, profile_id={profile_id}")

    if profile_id:
        # Check if another socket is already active for this profile
        if profile_id in profiles and "current_socket" in profiles[profile_id]:
            old_sid = profiles[profile_id]["current_socket"]
            if old_sid != sid:
                logger.warning(
                    f"Profile {profile_id} already has active socket {old_sid}. "
                    f"Closing old connection and accepting new one {sid}."
                )
                # Clean up the entire old session for this profile
                await cleanup_profile_connection(profile_id, "new socket takeover")
                # Forcefully disconnect the old socket from the server-side
                await sio.disconnect(old_sid, ignore_queue=True)

        # Initialize or update profile data for the new socket
        if profile_id not in profiles:
            profiles[profile_id] = {}
        profiles[profile_id]["current_socket"] = sid

        await sio.enter_room(sid, profile_id)

    await sio.emit('connection_confirmed', {
        'sid': sid,
        'profile_id': profile_id,
        'server_time': time.time()
    }, room=sid)

    logger.info(f"Client connected successfully: sid={sid}, profile_id={profile_id}")
    return True

@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with immediate cleanup"""
    logger.info(f"Client disconnecting: {sid}")
    
    # Find and clean up profile for this socket
    profile_to_cleanup = None
    for profile_id, profile_data in profiles.items():
        if profile_data.get("current_socket") == sid:
            profile_to_cleanup = profile_id
            break
    
    if profile_to_cleanup:
        await cleanup_profile_connection(profile_to_cleanup, "socket disconnect")
    
    # Remove from active connections
    for chat_id, connection_sid in list(active_connections.items()):
        if connection_sid == sid:
            del active_connections[chat_id]
            break

# Heartbeat mechanism
@sio.event  # type: ignore
async def ping(sid: str, data: Any = None) -> None:
    """Handle heartbeat ping from client"""
    await sio.emit('pong', {'timestamp': time.time()}, room=sid)

# WebRTC-specific Socket.IO events with connection ID tracking
@sio.event  # type: ignore
async def webrtc_start(sid: str, data: Dict[str, Any]) -> None:
    """Start WebRTC connection for a profile with connection ID tracking"""
    try:
        profile_id = data.get('profile_id')
        if not profile_id:
            await sio.emit('webrtc_error', {
                'error': 'Missing profile_id'
            }, room=sid)
            return
        
        # Verify this socket owns this profile
        if profile_id not in profiles or profiles[profile_id].get("current_socket") != sid:
            await sio.emit('webrtc_error', {
                'error': 'Socket not authorized for this profile'
            }, room=sid)
            return
        
        # Generate new connection ID
        connection_id = str(uuid.uuid4())
        logger.info(f"Starting WebRTC for profile {profile_id}, connection {connection_id}")
        
        # Clean up any existing peer connection first
        if "peer_connection" in profiles[profile_id] and profiles[profile_id]["peer_connection"]:
            try:
                await profiles[profile_id]["peer_connection"].close()
                logger.info(f"Closed existing peer connection for profile {profile_id}")
            except Exception as e:
                logger.error(f"Error closing existing peer connection: {e}")
        
        # Create new peer connection
        pc = await create_webrtc_peer_connection(profile_id, connection_id)
        
        # Create offer
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Debug: Log SDP structure to verify single audio track
        audio_lines = [line for line in offer.sdp.splitlines() if line.startswith('m=audio')]
        logger.info(f"SDP contains {len(audio_lines)} audio tracks for profile {profile_id}")
        
        # Send offer and ICE config to client
        await sio.emit('webrtc_offer', {
            'profile_id': profile_id,
            'connection_id': connection_id,
            'offer': {
                'sdp': offer.sdp,
                'type': offer.type
            },
            'ice_config': _build_ice_servers()
        }, room=sid)
        
        logger.info(f"Sent WebRTC offer to profile {profile_id}, connection {connection_id}")
        
    except Exception as e:
        logger.error(f"Error starting WebRTC: {e}")
        await sio.emit('webrtc_error', {
            'error': str(e)
        }, room=sid)

@sio.event  # type: ignore
async def webrtc_answer(sid: str, data: Dict[str, Any]) -> None:
    """Handle WebRTC answer from client with connection ID validation."""
    profile_id = data.get("profile_id")
    connection_id = data.get("connection_id")
    
    if not profile_id or not connection_id:
        logger.warning("Received webrtc_answer without profile_id or connection_id")
        return

    # Verify profile and connection ID
    if profile_id not in profiles:
        logger.warning(f"Received webrtc_answer for unknown profile: {profile_id}")
        return
        
    profile_data = profiles[profile_id]
    if profile_data.get("current_connection_id") != connection_id:
        logger.warning(f"Received webrtc_answer for stale connection {connection_id}, current is {profile_data.get('current_connection_id')}")
        return
        
    pc = profile_data.get("peer_connection")
    if not pc:
        logger.warning(f"Received webrtc_answer for non-existent peer connection for profile_id: {profile_id}")
        return
    
    # State guard: check if peer connection is still valid
    if pc.signalingState == "closed":
        logger.info(f"Stale signalling for closed PC {connection_id}, dropping")
        return
        
    logger.info(f"Received WebRTC answer from profile {profile_id}, connection {connection_id}")
    try:
        answer_data = data.get('answer')
        if not answer_data:
            await sio.emit('webrtc_error', {
                'error': 'Missing answer in webrtc_answer'
            }, room=profile_id)
            return

        # 👇 THIS IS THE FIX 👇
        # Before setting the remote description, force it to use Opus
        modified_sdp = force_opus_codec(answer_data["sdp"])
        answer_obj = RTCSessionDescription(sdp=modified_sdp, type=answer_data["type"])
        # 👆 END OF FIX 👆
        await pc.setRemoteDescription(answer_obj)
        logger.info(f"Successfully set MODIFIED remote description for profile {profile_id}")

        # --- Process any buffered ICE candidates ---
        buffered_candidates = profile_data.get("ice_candidates_buffer", [])
        if buffered_candidates:
            logger.info(f"Processing {len(buffered_candidates)} buffered ICE candidates for profile {profile_id}, connection {connection_id}")
            for candidate in buffered_candidates:
                try:
                    await pc.addIceCandidate(candidate)
                    logger.info(f"Successfully added buffered ICE candidate for {profile_id}")
                except Exception as e:
                    logger.error(
                        f"Error adding buffered ICE candidate for profile {profile_id}: {e}",
                        exc_info=True
                    )
            # Clear the buffer
            profile_data["ice_candidates_buffer"] = []
        
        await sio.emit("webrtc_ready", {
            "profile_id": profile_id, 
            "connection_id": connection_id
        }, room=profile_id)
        logger.info(f"WebRTC handshake complete, ready for profile {profile_id}, connection {connection_id}")

    except Exception as e:
        logger.error(f"Error handling WebRTC answer: {e}", exc_info=True)
        await sio.emit('webrtc_error', {
            'error': f'Failed to process answer: {e}'
        }, room=profile_id)

@sio.event  # type: ignore
async def webrtc_ice_candidate(sid: str, data: dict[str, Any]) -> None:
    """Handle incoming ICE candidates from the client with connection ID validation."""
    profile_id = data.get("profile_id")
    connection_id = data.get("connection_id")
    
    if not profile_id or not connection_id:
        logger.warning("Received webrtc_ice_candidate without profile_id or connection_id")
        return

    # Verify profile and connection ID
    if profile_id not in profiles:
        logger.warning(f"Received ICE candidate for unknown profile: {profile_id}")
        return
        
    profile_data = profiles[profile_id]
    if profile_data.get("current_connection_id") != connection_id:
        logger.warning(f"Received ICE candidate for stale connection {connection_id}, current is {profile_data.get('current_connection_id')}")
        return

    pc = profile_data.get("peer_connection")
    if not pc:
        logger.warning(f"Received ICE candidate for non-existent peer connection: {profile_id}")
        return

    # State guard: check if peer connection is still valid
    if pc.signalingState == "closed":
        logger.info(f"Stale signalling for closed PC {connection_id}, dropping")
        return

    candidate_data = data.get("candidate")
    if not candidate_data:
        logger.info(f"End of ICE candidates signal received for profile {profile_id}, connection {connection_id}")
        try:
            # An empty candidate signals the end of trickle ICE
            await pc.addIceCandidate(None)
        except Exception as e:
            logger.warning(f"Error adding null ICE candidate for {profile_id}, may already be closed: {e}")
        return

    try:
        # Reconstruct the RTCIceCandidate object from SDP string
        ice_candidate = candidate_from_sdp(candidate_data["candidate"])
        ice_candidate.sdpMid = candidate_data.get("sdpMid")
        ice_candidate.sdpMLineIndex = candidate_data.get("sdpMLineIndex")

        # Buffer candidate if remote description is not yet set
        if not pc.remoteDescription:
            logger.info(f"Buffering ICE candidate for {profile_id}, connection {connection_id} (remote description not set)")
            if "ice_candidates_buffer" not in profile_data:
                profile_data["ice_candidates_buffer"] = []
            profile_data["ice_candidates_buffer"].append(ice_candidate)
        else:
            await pc.addIceCandidate(ice_candidate)
            logger.info(f"Successfully added ICE candidate for {profile_id}, connection {connection_id}")

    except Exception as e:
        logger.error(
            f"Failed to process ICE candidate for profile {profile_id}, connection {connection_id}: {e}",
            exc_info=True
        )

@sio.event  # type: ignore
async def webrtc_start_audio(sid: str, data: Dict[str, Any]) -> None:
    """Signal from client that they are starting to send an audio track, and trigger renegotiation."""
    profile_id = data.get("profile_id")
    connection_id = data.get("connection_id")
    chat_id = data.get("chat_id")
    # MODIFIED: Get the audio preference from the client, default to True for safety
    assistant_audio_enabled = data.get("assistant_audio_enabled", True)
    
    if not profile_id or not connection_id or not chat_id:
        logger.error("Missing profile_id, connection_id, or chat_id for webrtc_start_audio")
        return

    # Add this log line for easier debugging
    logger.info(f"Client {sid} is starting audio for chat {chat_id} (assistant audio: {assistant_audio_enabled}), connection {connection_id}, beginning renegotiation.")
    
    # Verify profile and connection ID
    if profile_id not in profiles:
        logger.error(f"No profile found for {profile_id} to start audio.")
        await sio.emit('webrtc_error', {'error': 'Profile not found.'}, room=sid)
        return
        
    profile_data = profiles[profile_id]
    if profile_data.get("current_connection_id") != connection_id:
        logger.error(f"Connection ID mismatch for audio start: {connection_id} vs {profile_data.get('current_connection_id')}")
        await sio.emit('webrtc_error', {'error': 'Connection ID mismatch.'}, room=sid)
        return
    
    pc = profile_data.get("peer_connection")
    if not pc:
        logger.error(f"No peer connection found for profile {profile_id} to start audio.")
        await sio.emit('webrtc_error', {'error': 'Peer connection not found.'}, room=sid)
        return

    # State guard: check if peer connection is still valid
    if pc.signalingState == "closed":
        logger.info(f"Cannot start audio for closed PC {connection_id}")
        await sio.emit('webrtc_error', {'error': 'Peer connection is closed.'}, room=sid)
        return

    # MODIFIED: Associate the chat_id AND the audio preference with the connection
    pc.__dict__["_last_chat_id"] = chat_id
    pc.__dict__["_assistant_audio_enabled"] = assistant_audio_enabled

    try:
        # Create a new offer to trigger renegotiation
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Send the new offer to the client
        await sio.emit('webrtc_offer', {
            'profile_id': profile_id,
            'connection_id': connection_id,
            'offer': {
                'sdp': offer.sdp,
                'type': offer.type
            },
            'ice_config': _build_ice_servers() # Resending config might be needed by client
        }, room=sid)
        
        logger.info(f"Sent renegotiation offer to profile {profile_id}, connection {connection_id} for chat {chat_id}")

    except Exception as e:
        logger.error(f"Error during audio start renegotiation for profile {profile_id}, connection {connection_id}: {e}", exc_info=True)
        await sio.emit('webrtc_error', {'error': f'Failed to renegotiate for audio: {e}'}, room=sid)

@sio.event  # type: ignore
async def webrtc_stop_audio(sid: str, data: Dict[str, Any]) -> None:
    """Signal from client that they are stopping an audio track."""
    profile_id = data.get("profile_id")
    connection_id = data.get("connection_id")
    chat_id = data.get("chat_id")
    logger.info(f"Client {sid} is stopping audio for chat {chat_id}, connection {connection_id}")
    # Here you would add logic to signal the audio processing task to stop.
    # For now, we'll just log it. A robust implementation would use an asyncio.Event or similar.

# SPEC CHANGE: Renegotiation answer handler is no longer needed
# The server now uses a persistent audio track, eliminating the need for renegotiation

@sio.event  # type: ignore
async def join_chat(sid: str, data: dict[str, Any]) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        active_connections[chat_id] = sid
        logger.info(f"Client {sid} joined {chat_type} chat {chat_id} (room: {room_name})")
        await sio.emit('joined_chat', {'chat_id': chat_id, 'chat_type': chat_type}, room=sid)

@sio.event  # type: ignore
async def leave_chat(sid: str, data: dict[str, Any]) -> None:
    """Leave a specific chat room"""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        if chat_id in active_connections:
            del active_connections[chat_id]
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

def store_active_run(chat_id: str, run_result: Any) -> None:
    """Store an active run for potential cancellation"""
    active_runs[chat_id] = run_result

def cancel_active_run(chat_id: str) -> bool:
    """Cancel an active run and clean up"""
    if chat_id in active_runs:
        result = active_runs[chat_id]
        try:
            result.cancel()
            del active_runs[chat_id]
            logger.info(f"Successfully cancelled active run for chat {chat_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling active run {chat_id}: {e}")
            del active_runs[chat_id]
            return False
    return False

async def emit_chat_stopped(chat_id: str, chat_type: str, message: str = "Chat stopped successfully") -> None:
    """Emit chat_stopped event to the appropriate room"""
    await sio.emit('chat_stopped', {
        'chat_id': chat_id,
        'chat_type': chat_type,
        'message': message
    }, room=f"{chat_type}_{chat_id}")

@sio.event  # type: ignore
async def stop_chat(sid: str, data: dict[str, Any]) -> None:
    """Handle chat stop requests via WebSocket. TODO: Fix this to work and be generic."""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.emit('chat_stopped', {
            'chat_id': str(chat_id),
            'chat_type': chat_type
        }, room=sid)
        if chat_id in active_connections:
            del active_connections[chat_id]
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

def get_socketio_instance() -> socketio.AsyncServer:
    """Get the global Socket.IO server instance"""
    return sio

# Create a combined lifespan to manage both session managers
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        from app.services.mcp.server import server
        await stack.enter_async_context(server.session_manager.run())
        
        # Log WebRTC configuration
        logger.info("WebRTC Configuration:")
        logger.info(f"  TURN_PUBLIC_IP: {os.getenv('TURN_PUBLIC_IP', 'not set')}")
        logger.info(f"  TURN_REALM: {os.getenv('TURN_REALM', 'not set')}")
        logger.info(f"  TURN_USERNAME: {os.getenv('TURN_USERNAME', 'not set')}")
        logger.info(f"  TURN_PASSWORD: {'***' if os.getenv('TURN_PASSWORD') else 'not set'}")
        logger.info(f"  TURN_URI: {os.getenv('TURN_URI', 'not set')}")
        logger.info(f"  STUN_URI: {os.getenv('STUN_URI', 'not set')}")
        
        # Initialize Whisper model during startup
        try:
            from app.config import model_manager
            logger.info("Initializing Whisper model...")
            model_manager.initialize_whisper_model()
            logger.info("Whisper model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Whisper model: {e}")
            # Continue without Whisper - audio features will be disabled
        
        # Initialize Kokoro TTS model during startup
        try:
            logger.info("Initializing Kokoro TTS model...")
            model_manager.initialize_kokoro_pipeline()
            logger.info("Kokoro TTS model initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Kokoro TTS model: {e}")
            # Continue without Kokoro - TTS features will use fallback
        
        yield

# Create FastAPI app with lifespan
fastapi_app = FastAPI(title="GLOW API", on_startup=[init_db], lifespan=lifespan)

# Add CORS middleware FIRST
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Use the same origins as Socket.IO
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
fastapi_app.include_router(documents_router, prefix="/documents")
fastapi_app.include_router(scenarios_router, prefix="/scenarios")
fastapi_app.include_router(audio_router, prefix="/audio")
# Note: Removed rtc_router as we're migrating to WebSocket-based signaling

# mounting the mcp servers - ensure trailing slashes for proper routing
from app.services.mcp.server import server

fastapi_app.mount("/domain", server.streamable_http_app(), name="MCP Server")

# Create the combined ASGI app with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")

# Add specific logger for evaluation
eval_logger = logging.getLogger("app.agents.generic")
eval_logger.setLevel(logging.INFO)


@fastapi_app.get("/")
async def root_info() -> JSONResponse:
    """
    Return general server information.
    """
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": getattr(
            sys.modules.get("fastapi"), "__version__", "unknown"
        ),
    }
    return JSONResponse(content={"server_info": info})


@fastapi_app.get("/health")
async def health_check() -> JSONResponse:
    """
    Simple health check endpoint.
    """
    return JSONResponse(content={"status": "ok"})



if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
