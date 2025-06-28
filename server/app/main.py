# server/app/main.py
import asyncio
import contextlib
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
from aiortc import (RTCConfiguration, RTCIceCandidate,  # type: ignore
                    RTCIceServer, RTCPeerConnection, RTCSessionDescription)
from aiortc.sdp import candidate_from_sdp  # type: ignore
from app.db import get_session, init_db
from app.utils.audio import Modalities
from app.models import SimulationChats
from app.routes.documents import router as documents_router
from app.routes.scenarios import router as scenarios_router
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

# WebRTC global storage
webrtc_peer_connections: Dict[str, RTCPeerConnection] = {}  # profile_id -> peer_connection
webrtc_data_channels: Dict[str, Dict[str, Any]] = {}  # profile_id -> {channel_label: channel}
webrtc_ice_candidates_buffer: Dict[str, List[RTCIceCandidate]] = {}  # profile_id -> candidates

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

async def create_webrtc_peer_connection(profile_id: str) -> RTCPeerConnection:
    """Create a new WebRTC peer connection for a profile."""
    logger.info(f"Creating WebRTC peer connection for profile {profile_id}")
    
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
    
    # Prepare to receive an audio track
    pc.addTransceiver("audio", direction="recvonly")
    
    # Store the peer connection
    webrtc_peer_connections[profile_id] = pc
    webrtc_data_channels[profile_id] = {}
    webrtc_ice_candidates_buffer[profile_id] = []

    # ---- ensure at least one negotiated data channel so the initial SDP has an m-section ----
    signalling_dc = pc.createDataChannel("signalling")  # name arbitrary but consistent

    @signalling_dc.on("open")  # type: ignore
    def _() -> None:
        logger.info(f"Signalling data channel open for profile {profile_id}")
    # ------------------------------------------------------------------------------------------
    
    # Set up peer connection event handlers
    @pc.on("connectionstatechange")  # type: ignore
    async def on_connectionstatechange() -> None:
        logger.info(f"WebRTC connection state changed to {pc.connectionState} for profile {profile_id}")
        
        await sio.emit('webrtc_connection_state', {
            'profile_id': profile_id,
            'state': pc.connectionState
        }, room=profile_id)
        
        if pc.connectionState == "failed" or pc.connectionState == "closed":
            # Clean up on failure/closure
            await cleanup_webrtc_connection(profile_id)
    
    @pc.on("iceconnectionstatechange")  # type: ignore
    async def on_iceconnectionstatechange() -> None:
        logger.info(f"WebRTC ICE connection state changed to {pc.iceConnectionState} for profile {profile_id}")
        
        await sio.emit('webrtc_ice_state', {
            'profile_id': profile_id,
            'state': pc.iceConnectionState
        }, room=profile_id)
    
    @pc.on("icecandidate")  # type: ignore
    async def on_icecandidate(candidate: RTCIceCandidate | None) -> None:
        await sio.emit(
            "webrtc_ice_candidate",
            {
                "profile_id": profile_id,
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
        logger.info(f"Received track: {track.kind} for profile {profile_id}")
        if track.kind == "audio":
            chat_id = getattr(pc, "_last_chat_id", None)
            if chat_id:
                from app.web.simulations import process_audio_stream

                # move this to send in a stream of audio bytes, process in the simulation itself.
                asyncio.create_task(
                    process_audio_stream(track, chat_id, profile_id)
                )
            else:
                logger.warning(
                    f"Received audio track for profile {profile_id} but no chat_id was associated."
                )

    @pc.on("datachannel")  # type: ignore
    def on_datachannel(channel: Any) -> None:
        logger.info(f"Received data channel: {channel.label} for profile {profile_id}")
        webrtc_data_channels[profile_id][channel.label] = channel
        
        @channel.on("message")  # type: ignore
        def on_message(message: Any) -> None:
            # Handle incoming WebRTC data channel messages
            asyncio.create_task(handle_webrtc_data_message(profile_id, channel.label, message))
    
    return pc

async def cleanup_webrtc_connection(profile_id: str) -> None:
    """Clean up WebRTC connection for a profile."""
    logger.info(f"Cleaning up WebRTC connection for profile {profile_id}")
    
    # Close peer connection
    if profile_id in webrtc_peer_connections:
        pc = webrtc_peer_connections[profile_id]
        await pc.close()
    
    # Clean up data channels
    if profile_id in webrtc_data_channels:
        del webrtc_data_channels[profile_id]
    
    # Clean up ICE candidates buffer
    if profile_id in webrtc_ice_candidates_buffer:
        del webrtc_ice_candidates_buffer[profile_id]

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
register_assistant_events(sio)

@sio.event  # type: ignore
async def connect(sid: str, environ: Any, auth: Any) -> bool:
    """Handle WebSocket connection"""
    # Extract profile ID from query string for better logging
    query_string = environ.get('QUERY_STRING', '')
    profile_id = None
    if 'profileId=' in query_string:
        try:
            profile_id = query_string.split('profileId=')[1].split('&')[0]
        except IndexError:
            pass
    
    logger.info(f"Client connected: sid={sid}, profile_id={profile_id}, transport={environ.get('HTTP_UPGRADE', 'polling')}")
    
    # Join profile-specific room for WebRTC signaling
    if profile_id:
        await sio.enter_room(sid, profile_id)
    
    # Send immediate confirmation to client
    await sio.emit('connection_confirmed', {
        'sid': sid,
        'profile_id': profile_id,
        'server_time': time.time()
    }, room=sid)
    
    return True

@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection"""
    logger.info(f"Client disconnected: {sid}")
    # Remove from active connections
    for chat_id, connection_sid in list(active_connections.items()):
        if connection_sid == sid:
            del active_connections[chat_id]
            break

# WebRTC-specific Socket.IO events
@sio.event  # type: ignore
async def webrtc_start(sid: str, data: Dict[str, Any]) -> None:
    """Start WebRTC connection for a profile"""
    try:
        profile_id = data.get('profile_id')
        if not profile_id:
            await sio.emit('webrtc_error', {
                'error': 'Missing profile_id'
            }, room=sid)
            return
        
        logger.info(f"Starting WebRTC for profile {profile_id}")
        
        # Create peer connection
        pc = await create_webrtc_peer_connection(profile_id)
        
        # Create offer
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Send offer and ICE config to client
        await sio.emit('webrtc_offer', {
            'profile_id': profile_id,
            'offer': {
                'sdp': offer.sdp,
                'type': offer.type
            },
            'ice_config': _build_ice_servers()
        }, room=sid)
        
        logger.info(f"Sent WebRTC offer to profile {profile_id}")
        
    except Exception as e:
        logger.error(f"Error starting WebRTC: {e}")
        await sio.emit('webrtc_error', {
            'error': str(e)
        }, room=sid)

@sio.event  # type: ignore
async def webrtc_answer(sid: str, data: Dict[str, Any]) -> None:
    """Handle WebRTC answer from client."""
    profile_id = data.get("profile_id")
    if not profile_id:
        logger.warning("Received webrtc_answer without profile_id")
        return

    pc = webrtc_peer_connections.get(profile_id)
    if not pc:
        logger.warning(f"Received webrtc_answer for non-existent peer connection for profile_id: {profile_id}")
        return
        
    logger.info(f"Received WebRTC answer from profile {profile_id}")
    try:
        answer = data.get('answer')
        if not answer:
            await sio.emit('webrtc_error', {
                'error': 'Missing answer in webrtc_answer'
            }, room=profile_id)
            return

        # --- Set the remote description ---
        answer_obj = RTCSessionDescription(sdp=answer["sdp"], type=answer["type"])
        await pc.setRemoteDescription(answer_obj)
        logger.info(f"Successfully set remote description for profile {profile_id}")

        # --- Process any buffered ICE candidates ---
        buffered_candidates = webrtc_ice_candidates_buffer.pop(profile_id, [])
        if buffered_candidates:
            logger.info(f"Processing {len(buffered_candidates)} buffered ICE candidates for profile {profile_id}")
            for candidate in buffered_candidates:
                try:
                    await pc.addIceCandidate(candidate)
                    logger.info(f"Successfully added buffered ICE candidate for {profile_id}")
                except Exception as e:
                    logger.error(
                        f"Error adding buffered ICE candidate for profile {profile_id}: {e}",
                        exc_info=True
                    )
        
        await sio.emit("webrtc_ready", {"profile_id": profile_id}, room=profile_id)
        logger.info(f"WebRTC handshake complete, ready for profile {profile_id}")

    except Exception as e:
        logger.error(f"Error handling WebRTC answer: {e}", exc_info=True)
        await sio.emit('webrtc_error', {
            'error': f'Failed to process answer: {e}'
        }, room=profile_id)


@sio.event  # type: ignore
async def webrtc_ice_candidate(sid: str, data: dict[str, Any]) -> None:
    """Handle incoming ICE candidates from the client."""
    profile_id = data.get("profile_id")
    if not profile_id:
        logger.warning("Received webrtc_ice_candidate without profile_id")
        return

    pc = webrtc_peer_connections.get(profile_id)
    if not pc:
        logger.warning(f"Received ICE candidate for non-existent peer connection: {profile_id}")
        return

    candidate_data = data.get("candidate")
    if not candidate_data:
        logger.info(f"End of ICE candidates signal received for profile {profile_id}")
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
            logger.info(f"Buffering ICE candidate for {profile_id} (remote description not set)")
            webrtc_ice_candidates_buffer.setdefault(profile_id, []).append(ice_candidate)
        else:
            await pc.addIceCandidate(ice_candidate)
            logger.info(f"Successfully added ICE candidate for {profile_id}")

    except Exception as e:
        logger.error(
            f"Failed to process ICE candidate for profile {profile_id}: {e}",
            exc_info=True
        )

@sio.event  # type: ignore
async def webrtc_start_audio(sid: str, data: Dict[str, Any]) -> None:
    """Signal from client that they are starting to send an audio track, and trigger renegotiation."""
    profile_id = data.get("profile_id")
    chat_id = data.get("chat_id")
    if not profile_id or not chat_id:
        logger.error("Missing profile_id or chat_id for webrtc_start_audio")
        return

    logger.info(f"Client {sid} is starting audio for chat {chat_id}, beginning renegotiation.")
    
    pc = webrtc_peer_connections.get(profile_id)
    if not pc:
        logger.error(f"No peer connection found for profile {profile_id} to start audio.")
        await sio.emit('webrtc_error', {'error': 'Peer connection not found.'}, room=sid)
        return

    # Associate the next track for this profile with this chat_id.
    pc.__dict__["_last_chat_id"] = chat_id

    try:
        # Create a new offer to trigger renegotiation
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Send the new offer to the client
        await sio.emit('webrtc_offer', {
            'profile_id': profile_id,
            'offer': {
                'sdp': offer.sdp,
                'type': offer.type
            },
            'ice_config': _build_ice_servers() # Resending config might be needed by client
        }, room=sid)
        
        logger.info(f"Sent renegotiation offer to profile {profile_id} for chat {chat_id}")

    except Exception as e:
        logger.error(f"Error during audio start renegotiation for profile {profile_id}: {e}", exc_info=True)
        await sio.emit('webrtc_error', {'error': f'Failed to renegotiate for audio: {e}'}, room=sid)

@sio.event  # type: ignore
async def webrtc_stop_audio(sid: str, data: Dict[str, Any]) -> None:
    """Signal from client that they are stopping an audio track."""
    profile_id = data.get("profile_id")
    chat_id = data.get("chat_id")
    logger.info(f"Client {sid} is stopping audio for chat {chat_id}")
    # Here you would add logic to signal the audio processing task to stop.
    # For now, we'll just log it. A robust implementation would use an asyncio.Event or similar.

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
