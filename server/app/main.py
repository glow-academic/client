# server/app/main.py
import base64
import contextlib
import logging
import os
import platform
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict

import socketio  # type: ignore
from app.db import init_db
from app.routes.documents import router as documents_router
from app.routes.scenarios import router as scenarios_router
from app.routes.csv import router as csv_router
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Redis is nice in production, but optional in dev
try:
    from socketio import AsyncRedisManager
except ImportError:  # pip install redis-py not present
    AsyncRedisManager = None  # type: ignore
from sqlmodel import select

load_dotenv()

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

origin = os.getenv("ORIGIN", "http://localhost:3000")
app_prefix = os.getenv("APP_PREFIX", "").strip("/")
socket_path = f"{app_prefix}/socket.io" if app_prefix else "socket.io"

# ---------------------------------------------------------------------------+
# 2.  CORS etc. remains intact                                               +
# ---------------------------------------------------------------------------+
# Allow all origins
allowed_origins = [origin]

# Store active chat connections
active_connections: dict[str, str] = {}

# Global store for all active runs (unified tracking)
active_runs: dict[str, Any] = {}

# Profile-based connection management (simplified)
socket_owner: Dict[str, str] = {}  # profile_id -> socket_id


async def cleanup_profile_connection(profile_id: str, reason: str = "cleanup") -> None:
    """Clean up all connections for a profile."""
    logger.info(f"Cleaning up profile {profile_id} connections - {reason}")

    # Remove from socket ownership
    socket_owner.pop(profile_id, None)

    # Update database to mark profile as inactive
    try:
        from app.db import get_session
        from app.models import Profiles

        db_session = next(get_session())
        try:
            profile = db_session.exec(
                select(Profiles).where(Profiles.id == profile_id)
            ).one_or_none()

            if profile:
                profile.active = False
                profile.last_active = datetime.now(timezone.utc)
                db_session.add(profile)
                db_session.commit()
                logger.info(f"Updated profile {profile_id} to inactive in database")
        finally:
            db_session.close()
    except Exception as e:
        logger.error(f"Error updating profile {profile_id} in database: {e}")


# ----------  Socket.IO with Redis message queue  ----------
redis_url = os.getenv("REDIS_URL")  # don't default when unset

if redis_url and AsyncRedisManager:
    logger.info(f"Socket.IO: clustering via Redis → {redis_url}")
    redis_manager = AsyncRedisManager(redis_url)
else:
    logger.info("Socket.IO: no REDIS_URL - using in-memory manager")
    redis_manager = None  # ⇢ default AsyncManager

kwargs = {}
if redis_manager is not None:  # only pass when we actually have it
    kwargs["client_manager"] = redis_manager

# Create Socket.IO server instance globally
sio = socketio.AsyncServer(
    **kwargs,
    cors_allowed_origins=allowed_origins,
    cors_credentials=True,
    logger=True,  # Enable logging for debugging
    engineio_logger=True,  # Enable engine.io logging
    async_mode="asgi",
    # Support both transports but prioritize websocket
    transports=["websocket", "polling"],
    # Allow upgrades from polling to websocket
    allow_upgrades=True,
    # Optimized timeouts for faster connection
    ping_timeout=60,
    ping_interval=25,
    # Optimized Engine.IO options
    engineio_options={
        "max_http_buffer_size": 1000000,
        "ping_timeout": 60,
        "ping_interval": 25,
        "compression": False,  # Disable compression for better performance
        "cookie": False,  # Disable cookies for stateless operation
    },
)

from app.web.assistants import register_assistant_events
# Import and register WebSocket events after sio is created to avoid circular imports
from app.web.simulations import register_simulation_events

# Register simulation and assistant WebSocket events
register_simulation_events(sio)
register_assistant_events(sio)

# WebSocket events will be registered after sio is created


@sio.event  # type: ignore
async def send_simulation_message(sid: str, data: Dict[str, Any]) -> None:
    """Handle simulation message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")
        assistant_audio_enabled = data.get("assistant_audio_enabled", False)
        sketch_data = data.get("sketch_data")

        if not chat_id or (not message and not sketch_data):
            logger.error(
                f"Missing chat_id or both message and sketch_data in request from {sid}"
            )
            return

        # Convert base64 sketch data to bytes if present
        sketch_bytes = None
        if sketch_data:
            try:
                # Remove data URL prefix if present (data:image/png;base64,)
                if sketch_data.startswith("data:"):
                    sketch_data = sketch_data.split(",", 1)[1]
                sketch_bytes = base64.b64decode(sketch_data)
                logger.info(f"Decoded sketch data: {len(sketch_bytes)} bytes")
            except Exception as e:
                logger.error(f"Error decoding sketch data: {e}")
                sketch_bytes = None

        logger.info(
            f"Processing send_simulation_message from {sid}: {chat_id} (audio: {assistant_audio_enabled}, sketch: {sketch_bytes is not None})"
        )

        # Process the message via WebSocket
        from app.web.simulations import process_simulation_message_websocket

        await process_simulation_message_websocket(
            chat_id=chat_id,
            message=message or "",
        )

    except Exception as e:
        logger.error(f"Error in send_simulation_message for {sid}: {str(e)}")
        await sio.emit(
            "simulation_error",
            {"success": False, "message": str(e)},
            room=sid,
        )


@sio.event  # type: ignore
async def send_assistant_message(sid: str, data: Dict[str, Any]) -> None:
    """Handle assistant message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")

        if not chat_id or not message:
            logger.error(f"Missing chat_id or message in request from {sid}")
            return

        logger.info(
            f"Processing send_assistant_message from {sid}: {chat_id}, message: {message[:50]}..."
        )

        # Process the message via WebSocket
        from app.web.assistants import process_assistant_message_websocket

        await process_assistant_message_websocket(
            chat_id=uuid.UUID(chat_id), message=message
        )

        logger.info(f"Completed processing send_assistant_message for {chat_id}")

    except Exception as e:
        logger.error(f"Error in send_assistant_message for {sid}: {str(e)}")
        await sio.emit(
            "assistant_error",
            {"success": False, "message": str(e)},
            room=sid,
        )


@sio.event  # type: ignore
async def connect(sid: str, environ: Any, auth: Any) -> bool:
    """Handle WebSocket connection with robust, profile-based socket management."""
    query_string = environ.get("QUERY_STRING", "")
    profile_id: str | None = None
    guest_id: str | None = None

    # Very lightweight QS parsing (qs is short); avoid full parser to keep dep surface small
    try:
        parts = query_string.split("&") if query_string else []
        for p in parts:
            if p.startswith("profileId="):
                val = p[len("profileId=") :]
                if val:  # empty means guest
                    profile_id = val
            elif p.startswith("guestId="):
                val = p[len("guestId=") :]
                if val:
                    guest_id = val
    except Exception:  # defensive; ignore malformed
        pass

    logger.info(
        f"Client connecting: sid={sid}, profile_id={profile_id}, guest_id={guest_id}"
    )

    if profile_id:
        # Check if another socket is already active for this profile
        if profile_id in socket_owner:
            old_sid = socket_owner[profile_id]
            if old_sid != sid:
                logger.warning(
                    f"Profile {profile_id} already has active socket {old_sid}. "
                    f"Closing old connection and accepting new one {sid}."
                )
                # Clean up the entire old session for this profile
                await cleanup_profile_connection(profile_id, "new socket takeover")
                # Forcefully disconnect the old socket from the server-side
                await sio.disconnect(old_sid, ignore_queue=True)

        # Store socket ownership
        socket_owner[profile_id] = sid
        await sio.enter_room(sid, profile_id)

        # Update database to mark profile as active
        try:
            from app.db import get_session
            from app.models import Profiles

            db_session = next(get_session())
            try:
                profile = db_session.exec(
                    select(Profiles).where(Profiles.id == profile_id)
                ).one_or_none()

                if profile:
                    profile.active = True
                    profile.last_active = datetime.now(timezone.utc)
                    db_session.add(profile)
                    db_session.commit()
                    logger.info(f"Updated profile {profile_id} to active in database")
            finally:
                db_session.close()
        except Exception as e:
            logger.error(f"Error updating profile {profile_id} in database: {e}")
    else:
        # Guest connection (no profile). Optionally join a guest room for targeted emits.
        if guest_id:
            await sio.enter_room(sid, f"guest_{guest_id}")
            logger.info(f"Guest {guest_id} joined room guest_{guest_id}")
        else:
            logger.info("Anonymous guest connection with no guest_id; broadcasts only.")

    await sio.emit(
        "connection_confirmed",
        {
            "sid": sid,
            "profile_id": profile_id,
            "guest_id": guest_id,
            "server_time": time.time(),
        },
        room=sid,
    )

    logger.info(
        f"Client connected successfully: sid={sid}, profile_id={profile_id}, guest_id={guest_id}"
    )
    return True


@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with immediate cleanup"""
    logger.info(f"Client disconnecting: {sid}")

    # Find and clean up profile for this socket
    profile_to_cleanup = None
    for profile_id, socket_id in socket_owner.items():
        if socket_id == sid:
            profile_to_cleanup = profile_id
            break

    if profile_to_cleanup:
        await cleanup_profile_connection(profile_to_cleanup, "socket disconnect")

    # Remove from active connections
    for chat_id, connection_sid in list(active_connections.items()):
        if connection_sid == sid:
            del active_connections[chat_id]
            break


@sio.event  # type: ignore
async def join_chat(sid: str, data: dict[str, Any]) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.get("chat_id")
    chat_type = data.get(
        "chat_type", "assistant"
    )  # Default to assistant for backward compatibility

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        active_connections[chat_id] = sid
        logger.info(
            f"Client {sid} joined {chat_type} chat {chat_id} (room: {room_name})"
        )
        await sio.emit(
            "joined_chat", {"chat_id": chat_id, "chat_type": chat_type}, room=sid
        )


@sio.event  # type: ignore
async def leave_chat(sid: str, data: dict[str, Any]) -> None:
    """Leave a specific chat room"""
    chat_id = data.get("chat_id")
    chat_type = data.get(
        "chat_type", "assistant"
    )  # Default to assistant for backward compatibility

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


async def emit_chat_stopped(
    chat_id: str, chat_type: str, message: str = "Chat stopped successfully"
) -> None:
    """Emit chat_stopped event to the appropriate room"""
    await sio.emit(
        "chat_stopped",
        {"chat_id": chat_id, "chat_type": chat_type, "message": message},
        room=f"{chat_type}_{chat_id}",
    )


@sio.event  # type: ignore
async def stop_chat(sid: str, data: dict[str, Any]) -> None:
    """Handle chat stop requests via WebSocket. TODO: Fix this to work and be generic."""
    chat_id = data.get("chat_id")
    chat_type = data.get(
        "chat_type", "assistant"
    )  # Default to assistant for backward compatibility

    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.emit(
            "chat_stopped", {"chat_id": str(chat_id), "chat_type": chat_type}, room=sid
        )
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
        
        yield


# Create FastAPI app
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
fastapi_app.include_router(csv_router, prefix="/csv")

# mounting the mcp servers - ensure trailing slashes for proper routing
from app.services.mcp.server import server

fastapi_app.mount("/domain", server.streamable_http_app(), name="MCP Server")

# Create the combined ASGI app with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app, socketio_path=socket_path)

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
