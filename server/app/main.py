# server/app/main.py
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
from app.db import get_session, init_db
from app.models import SimulationChats
from app.routes.documents import router as documents_router
from app.routes.profiles import router as profiles_router
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

# Allow all origins
allowed_origins = [
    "http://localhost:3000",
    "http://client:3000",
]

# Store active chat connections
active_connections: dict[str, str] = {}

# Global store for all active runs (unified tracking)
active_runs: dict[str, Any] = {}

# WebRTC global storage
webrtc_peer_connections: Dict[str, RTCPeerConnection] = {}  # profile_id -> peer_connection
webrtc_data_channels: Dict[str, Dict[str, Any]] = {}  # profile_id -> {channel_label: channel}
webrtc_ice_candidates_buffer: Dict[str, List[RTCIceCandidate]] = {}  # profile_id -> candidates

def _build_ice_servers() -> List[Dict[str, Any]]:
    """Return ICE server configuration for WebRTC connections."""
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
        "Using ICE servers for WebRTC: %s",
        ", ".join(
            [url for s in ice_servers for url in (s["urls"] if isinstance(s["urls"], list) else [s["urls"]])]
        ),
    )

    return ice_servers

def get_ice_config() -> Dict[str, Any]:
    """Get ICE server configuration in client-friendly format."""
    ice_servers = _build_ice_servers()
    
    # Flatten for client consumption
    urls = []
    username = None
    credential = None
    
    for server in ice_servers:
        if isinstance(server["urls"], list):
            urls.extend(server["urls"])
        else:
            urls.append(server["urls"])
        
        if "username" in server:
            username = server["username"]
            credential = server["credential"]
    
    return {
        "urls": urls,
        "username": username,
        "credential": credential
    }

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
    
    # Store the peer connection
    webrtc_peer_connections[profile_id] = pc
    webrtc_data_channels[profile_id] = {}
    webrtc_ice_candidates_buffer[profile_id] = []
    
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
    async def on_icecandidate(candidate: RTCIceCandidate) -> None:
        if candidate:
            # Send ICE candidate via Socket.IO
            await sio.emit('webrtc_ice_candidate', {
                'profile_id': profile_id,
                'candidate': {
                    'candidate': str(candidate),
                    'sdpMid': candidate.sdpMid,
                    'sdpMLineIndex': candidate.sdpMLineIndex,
                }
            }, room=profile_id)
    
    @pc.on("datachannel")  # type: ignore
    def on_datachannel(channel: Any) -> None:
        logger.info(f"Received data channel: {channel.label} for profile {profile_id}")
        webrtc_data_channels[profile_id][channel.label] = channel
        
        @channel.on("message")  # type: ignore
        def on_message(message: Any) -> None:
            # Handle incoming WebRTC data channel messages
            import asyncio
            asyncio.create_task(handle_webrtc_data_message(profile_id, channel.label, message))
    
    return pc

async def cleanup_webrtc_connection(profile_id: str) -> None:
    """Clean up WebRTC connection for a profile."""
    logger.info(f"Cleaning up WebRTC connection for profile {profile_id}")
    
    # Close peer connection
    if profile_id in webrtc_peer_connections:
        pc = webrtc_peer_connections[profile_id]
        pc.close()
        del webrtc_peer_connections[profile_id]
    
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
        
        message_type = data.get('type')
        chat_id = data.get('chat_id')
        content = data.get('content', '')
        
        if not chat_id:
            logger.error(f"No chat_id in WebRTC message: {data}")
            return
        
        # Determine chat type from channel label or chat_id prefix
        chat_type = 'simulation'  # Default
        if channel_label.startswith('text-') or channel_label.startswith('audio-'):
            # Try to determine chat type from chat_id or context
            # Could be enhanced to detect from active rooms or chat_id patterns
            if 'assistant' in chat_id or 'asst' in chat_id:
                chat_type = 'assistant'
            elif 'eval' in chat_id:
                chat_type = 'eval'
            # Otherwise defaults to 'simulation'
            
            if message_type == 'text_message':
                # Handle text message
                await process_webrtc_text_message(profile_id, chat_id, content, chat_type)
            elif message_type == 'audio_message':
                # Handle audio message (for now, just empty content)
                audio_data = data.get('audio_data')  # base64 encoded audio
                await process_webrtc_audio_message(profile_id, chat_id, content, audio_data, chat_type)
            elif message_type == 'message_complete':
                # Message is complete, process it
                is_audio = data.get('is_audio', False)
                audio_data = data.get('audio_data') if is_audio else None
                await process_webrtc_complete_message(profile_id, chat_id, content, is_audio, audio_data, chat_type)
        
    except Exception as e:
        logger.error(f"Error handling WebRTC data message: {e}")

async def process_webrtc_text_message(profile_id: str, chat_id: str, content: str, chat_type: str) -> None:
    """Process a text message received via WebRTC."""
    # Import the appropriate processing function based on chat type
    if chat_type == 'simulation':
        from app.web.simulations import process_simulation_message_websocket
        await process_simulation_message_websocket(
            chat_id=chat_id,
            message=content,
            is_audio=False,
            session=None
        )
    elif chat_type == 'assistant':
        from app.web.assistants import process_assistant_message_websocket
        await process_assistant_message_websocket(
            chat_id=uuid.UUID(chat_id),
            message=content,
            is_audio=False,
            session=None
        )
    elif chat_type == 'eval':
        # Eval system doesn't have individual message processing like the others
        # It processes entire eval runs. For now, log this case.
        logger.info(f"WebRTC eval message received but eval system doesn't support individual messages: {chat_id}")
    else:
        logger.warning(f"Unknown chat type for WebRTC message: {chat_type}")

async def process_webrtc_audio_message(profile_id: str, chat_id: str, content: str, audio_data: Optional[str], chat_type: str) -> None:
    """Process an audio message received via WebRTC."""
    # For now, just process as empty text since we're removing Whisper logic
    # In the future, this could decode the base64 audio_data and process it
    
    if chat_type == 'simulation':
        from app.web.simulations import process_simulation_message_websocket
        await process_simulation_message_websocket(
            chat_id=chat_id,
            message="",  # Empty content for audio messages for now
            is_audio=True,
            audio_data=None,  # Could decode audio_data here
            session=None
        )
    elif chat_type == 'assistant':
        from app.web.assistants import process_assistant_message_websocket
        await process_assistant_message_websocket(
            chat_id=uuid.UUID(chat_id),
            message="",  # Empty content for audio messages for now
            is_audio=True,
            session=None
        )
    elif chat_type == 'eval':
        logger.info(f"WebRTC eval audio message received but eval system doesn't support individual messages: {chat_id}")
    else:
        logger.warning(f"Unknown chat type for WebRTC audio message: {chat_type}")

async def process_webrtc_complete_message(profile_id: str, chat_id: str, content: str, is_audio: bool, audio_data: Optional[str], chat_type: str) -> None:
    """Process a complete message (text or audio) received via WebRTC."""
    logger.info(f"Processing complete WebRTC message for chat {chat_id}, is_audio: {is_audio}")
    
    if chat_type == 'simulation':
        from app.web.simulations import process_simulation_message_websocket
        await process_simulation_message_websocket(
            chat_id=chat_id,
            message=content,
            is_audio=is_audio,
            audio_data=None,  # Could decode audio_data here
            session=None
        )
    elif chat_type == 'assistant':
        from app.web.assistants import process_assistant_message_websocket
        await process_assistant_message_websocket(
            chat_id=uuid.UUID(chat_id),
            message=content,
            is_audio=is_audio,
            session=None
        )
    elif chat_type == 'eval':
        logger.info(f"WebRTC eval complete message received but eval system doesn't support individual messages: {chat_id}")
    else:
        logger.warning(f"Unknown chat type for WebRTC complete message: {chat_type}")

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
from app.web.evals import register_eval_events
# Register simulation WebSocket events IMMEDIATELY after sio creation
from app.web.simulations import register_simulation_events

register_simulation_events(sio)
register_assistant_events(sio)
register_eval_events(sio)

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
            'ice_config': get_ice_config()
        }, room=sid)
        
        logger.info(f"Sent WebRTC offer to profile {profile_id}")
        
    except Exception as e:
        logger.error(f"Error starting WebRTC: {e}")
        await sio.emit('webrtc_error', {
            'error': str(e)
        }, room=sid)

@sio.event  # type: ignore
async def webrtc_answer(sid: str, data: Dict[str, Any]) -> None:
    """Handle WebRTC answer from client"""
    try:
        profile_id = data.get('profile_id')
        answer_data = data.get('answer')
        
        if not profile_id or not answer_data:
            await sio.emit('webrtc_error', {
                'error': 'Missing profile_id or answer'
            }, room=sid)
            return
        
        logger.info(f"Received WebRTC answer from profile {profile_id}")
        
        pc = webrtc_peer_connections.get(profile_id)
        if not pc:
            await sio.emit('webrtc_error', {
                'error': 'No peer connection found'
            }, room=sid)
            return
        
        # Set remote description
        answer = RTCSessionDescription(
            sdp=answer_data['sdp'],
            type=answer_data['type']
        )
        await pc.setRemoteDescription(answer)
        
        logger.info(f"Set remote description for profile {profile_id}")
        
        # Send any buffered ICE candidates
        buffered_candidates = webrtc_ice_candidates_buffer.get(profile_id, [])
        for candidate in buffered_candidates:
            await sio.emit('webrtc_ice_candidate', {
                'profile_id': profile_id,
                'candidate': {
                    'candidate': str(candidate),
                    'sdpMid': candidate.sdpMid,
                    'sdpMLineIndex': candidate.sdpMLineIndex,
                }
            }, room=profile_id)
        
        # Clear buffer
        webrtc_ice_candidates_buffer[profile_id] = []
        
        await sio.emit('webrtc_ready', {
            'profile_id': profile_id
        }, room=sid)
        
    except Exception as e:
        logger.error(f"Error handling WebRTC answer: {e}")
        await sio.emit('webrtc_error', {
            'error': str(e)
        }, room=sid)

@sio.event  # type: ignore
async def webrtc_ice_candidate(sid: str, data: Dict[str, Any]) -> None:
    """Handle ICE candidate from client"""
    try:
        profile_id = data.get('profile_id')
        candidate_data = data.get('candidate')
        
        if not profile_id or not candidate_data:
            return
        
        pc = webrtc_peer_connections.get(profile_id)
        if not pc:
            return
        
        # Parse and add ICE candidate
        candidate_str = candidate_data.get('candidate')
        if not candidate_str:
            return
        
        # Parse candidate string
        parts = candidate_str.split()
        if len(parts) < 8:
            logger.error(f"Invalid candidate format: {candidate_str}")
            return
        
        foundation = parts[0].split(':')[1]
        component = int(parts[1])
        protocol = parts[2]
        priority = int(parts[3])
        ip = parts[4]
        port = int(parts[5])
        
        if "typ" not in parts:
            logger.error(f"No 'typ' found in candidate: {candidate_str}")
            return
        typ_index = parts.index("typ")
        candidate_type = parts[typ_index + 1]
        
        # Handle related address and port
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
        logger.debug(f"Added ICE candidate for profile {profile_id}")
        
    except Exception as e:
        logger.error(f"Error handling ICE candidate: {e}")

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
fastapi_app.include_router(profiles_router, prefix="/profiles")
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


def fake_chat_stream(user_message: str) -> Generator[bytes, None, None]:
    """
    Simulate streaming a chat response back in chunks.
    """
    # A very simple echo + delay demo
    words = f"Echo: {user_message}".split()
    for word in words:
        yield (word + " ").encode("utf-8")
        time.sleep(0.3)
    # indicate end of stream
    yield b""


@fastapi_app.get("/db-test")
async def test_db_connection(session: Session = Depends(get_session)) -> JSONResponse:
    """Test database connection"""
    try:
        # Try a simple query
        session.exec(select(SimulationChats)).first()
        return JSONResponse(content={"status": "Database connection successful"})
    except Exception as e:
        logger.exception(f"Database connection error: {str(e)}")
        return JSONResponse(
            content={"status": "Database connection failed", "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
