# server/app/main.py
import asyncio
import contextlib
import logging
import os
import platform
import sys
import time
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs

import socketio  # type: ignore
from app.db import close_db_pool, init_db_pool
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Redis is nice in production, but optional in dev
try:
    from socketio import AsyncRedisManager
except ImportError:  # pip install redis-py not present
    AsyncRedisManager = None  # type: ignore

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

# Import Redis functions from extensions
from app.extensions import (  # New Redis functions for active connections and runs; Guest management functions
    add_guest_socket, cleanup_redis_client, decrement_guest_count,
    find_chats_by_socket, find_profile_by_socket, get_socket_owner,
    increment_guest_count, init_query_client, init_redis_client,
    is_guest_socket, remove_active_connection, remove_guest_socket,
    remove_socket_owner, set_active_connection, set_active_run,
    set_socket_owner)

# Store active chat connections - now using Redis
# active_connections: dict[str, str] = {}  # REMOVED - using Redis instead

# Global in-process store for active Runner results to support immediate cancel
active_results: dict[str, dict[str, Any]] = {}

# Profile-based connection management (simplified) - now using Redis
# socket_owner: Dict[str, str] = {}  # profile_id -> socket_id - REMOVED, using Redis

# Track guest connections without restricting concurrency - now using Redis
# guest_connection_count: int = 0 - REMOVED, using Redis
# guest_sids: set[str] = set() - REMOVED, using Redis


async def cleanup_profile_connection(profile_id: str, reason: str = "cleanup") -> None:
    """Clean up all connections for a profile."""
    logger.info(f"Cleaning up profile {profile_id} connections - {reason}")

    # Remove from socket ownership using Redis
    await remove_socket_owner(profile_id)

    # Update database to mark profile as inactive
    try:
        from app.db import get_pool
        from app.queries.profile_queries import ProfileQueries

        pool = get_pool()
        if pool:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    queries = ProfileQueries()
                    update_query, insert_query = queries.update_profile_to_inactive()
                    last_active = datetime.now(UTC)
                    await conn.execute(update_query, profile_id)
                    await conn.execute(insert_query, profile_id, last_active)
            logger.info(f"Updated profile {profile_id} to inactive in database")
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

from app.web.assistants import register_assistant_events  # noqa: E402
# Import and register WebSocket events after sio is created to avoid circular imports
from app.web.simulations import register_simulation_events  # noqa: E402

# Register simulation and assistant WebSocket events
register_simulation_events(sio)
register_assistant_events(sio)

# WebSocket events will be registered after sio is created


@sio.event  # type: ignore
async def send_simulation_message(sid: str, data: dict[str, Any]) -> None:
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

        logger.info(
            f"Processing send_simulation_message from {sid}: {chat_id} (audio: {assistant_audio_enabled}, sketch: {sketch_data is not None})"
        )

        # Process the message via WebSocket
        from app.web.simulations import process_simulation_message_websocket

        # Extract isRetry flag from data
        is_retry = data.get("isRetry", False)

        await process_simulation_message_websocket(
            chat_id=uuid.UUID(chat_id),
            message=message or "",
            is_retry=is_retry,
        )

    except Exception as e:
        logger.error(f"Error in send_simulation_message for {sid}: {str(e)}")

        # Try to create an error message in the database if we have a valid chat_id
        try:
            chat_id = data.get("chat_id")
            if chat_id:
                from app.db import get_pool

                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        # Create an error message in the database
                        from app.queries.simulation_queries import \
                            SimulationQueries

                        queries = SimulationQueries()
                        query = queries.insert_error_message()
                        error_message = await conn.fetchrow(
                            query,
                            uuid.UUID(chat_id),
                            "response",
                            f"Error: {str(e)}",
                            True,
                        )

                        # Emit the error message to clients
                        if error_message:
                            await sio.emit(
                                "simulation_new_message",
                                {
                                    "message_id": str(error_message["id"]),
                                    "chat_id": str(chat_id),
                                    "role": "assistant",
                                    "content": f"Error: {str(e)}",
                                    "completed": True,
                                    "created_at": error_message[
                                        "created_at"
                                    ].isoformat(),
                                },
                                room=f"simulation_{chat_id}",
                            )
        except Exception as db_error:
            logger.error(f"Failed to create error message in database: {db_error}")

        # Also emit the error event for backward compatibility
        await sio.emit(
            "simulation_error",
            {"success": False, "message": str(e)},
            room=sid,
        )


@sio.event  # type: ignore
async def send_assistant_message(sid: str, data: dict[str, Any]) -> None:
    """Handle assistant message sending requests"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message")
        department_id = data.get("department_id")

        if not department_id:
            logger.error(f"Missing department_id in request from {sid}")
            return

        if not chat_id or not message:
            logger.error(f"Missing chat_id or message in request from {sid}")
            return

        logger.info(
            f"Processing send_assistant_message from {sid}: {chat_id}, message: {message[:50]}..."
        )

        # Process the message via WebSocket
        from app.web.assistants import process_assistant_message_websocket

        await process_assistant_message_websocket(
            chat_id=uuid.UUID(chat_id), message=message, department_id=department_id
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

    # Parse query string using urllib.parse for proper URL decoding
    try:
        params = parse_qs(query_string)
        profile_id = params.get("profileId", [None])[0]
        guest_id = params.get("guestId", [None])[0]
    except Exception:  # defensive; ignore malformed
        pass

    logger.info(
        f"Client connecting: sid={sid}, profile_id={profile_id}, guest_id={guest_id}"
    )

    # Resolve "guest-profile-id" to actual default guest profile
    if profile_id == "guest-profile-id":
        try:
            from app.db import get_pool
            from app.services.profile_service import ProfileService

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    profile_service = ProfileService(conn)
                    resolved_guest_id = (
                        await profile_service.get_default_guest_profile_id()
                    )
                    if resolved_guest_id:
                        profile_id = str(resolved_guest_id)
                        logger.info(
                            f"Resolved 'guest-profile-id' to actual guest profile: {profile_id}"
                        )
                    else:
                        logger.warning(
                            "No default guest profile found; treating as anonymous guest"
                        )
                        profile_id = None
            else:
                logger.error(
                    "Database pool not available; cannot resolve guest profile"
                )
                profile_id = None
        except Exception as e:
            logger.error(f"Error resolving guest profile: {e}")
            profile_id = None

    if profile_id:
        # Check if another socket is already active for this profile
        old_sid = await get_socket_owner(profile_id)
        if old_sid and old_sid != sid:
            logger.warning(
                f"Profile {profile_id} already has active socket {old_sid}. "
                f"Closing old connection and accepting new one {sid}."
            )
            # Clean up the entire old session for this profile
            await cleanup_profile_connection(profile_id, "new socket takeover")
            # Forcefully disconnect the old socket from the server-side
            await sio.disconnect(old_sid)

        # Store socket ownership
        await set_socket_owner(profile_id, sid)
        await sio.enter_room(sid, profile_id)

        # Update database to mark profile as active
        try:
            from app.db import get_pool
            from app.queries.profile_queries import ProfileQueries

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        queries = ProfileQueries()
                        update_query, insert_query = queries.update_profile_to_active()
                        last_active = datetime.now(UTC)
                        await conn.execute(update_query, profile_id)
                        await conn.execute(insert_query, profile_id, last_active)
                    logger.info(f"Updated profile {profile_id} to active in database")
        except Exception as e:
            logger.error(f"Error updating profile {profile_id} in database: {e}")
    else:
        # Guest connection (no profile). Optionally join a guest room for targeted emits.
        if guest_id:
            await sio.enter_room(sid, f"guest_{guest_id}")
            logger.info(f"Guest {guest_id} joined room guest_{guest_id}")
            # Track guest connection and update default guest profile activity
            try:
                await add_guest_socket(sid)
                # Increment guest connection counter
                await increment_guest_count()

                from app.db import get_pool
                from app.queries.profile_queries import ProfileQueries

                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        async with conn.transaction():
                            # Find and update default guest profile
                            queries = ProfileQueries()
                            update_query, insert_query = queries.update_default_guest_profile_to_active()
                            await conn.execute(update_query)
                            await conn.execute(insert_query, datetime.now(UTC))
                        logger.info(
                            "Marked default guest profile active (guest connection added)"
                        )
            except Exception as e:
                logger.error(
                    f"Error updating default guest profile activity on connect: {e}"
                )
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
    # Find and clean up profile for this socket using Redis
    profile_to_cleanup = await find_profile_by_socket(sid)

    if profile_to_cleanup:
        await cleanup_profile_connection(profile_to_cleanup, "socket disconnect")

    # If this was a guest connection, update counter and default guest profile activity
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            # Decrement guest count and get remaining count
            remaining_guests = await decrement_guest_count()

            from app.db import get_pool
            from app.queries.profile_queries import ProfileQueries

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        # Update default guest profile: refresh last_active, set active False only when all guests are gone
                        queries = ProfileQueries()
                        update_query, insert_query = queries.update_default_guest_profile_activity()
                        await conn.execute(update_query, datetime.now(UTC), remaining_guests > 0)
                        await conn.execute(insert_query, datetime.now(UTC))
                    logger.info(
                        f"Updated default guest profile activity on disconnect (remaining guests: {remaining_guests})"
                    )
        except Exception as e:
            logger.error(
                f"Error updating default guest profile activity on disconnect: {e}"
            )

    # Remove from all active connections using Redis
    chat_ids = await find_chats_by_socket(sid)
    for chat_id in chat_ids:
        await remove_active_connection(chat_id)


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
        await set_active_connection(chat_id, sid)
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
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


async def store_active_run(chat_id: str, run_result: Any) -> None:
    """Store an active run for potential cancellation"""
    # Generate a unique run ID for cooperative cancellation
    run_id = str(uuid.uuid4())
    await set_active_run(chat_id, run_id)


async def store_active_result(chat_id: str, result: Any) -> None:
    """Store the Runner result object locally for immediate cancel."""
    if chat_id not in active_results:
        active_results[chat_id] = {}
    active_results[chat_id]["result"] = result


async def store_active_events(chat_id: str, events_iter: Any) -> None:
    """Store the events iterator (async generator) to allow aclose() on cancel."""
    if chat_id not in active_results:
        active_results[chat_id] = {}
    active_results[chat_id]["events"] = events_iter


async def cancel_active_result(chat_id: str) -> bool:
    """Call cancel() on the local Runner result if present."""
    entry = active_results.get(chat_id)
    if not entry:
        return False
    try:
        result = entry.get("result")
        events_iter = entry.get("events")

        # Best-effort: ask the Runner to cancel upstream generation
        if result is not None and hasattr(result, "cancel"):
            cancel_result = result.cancel()
            if asyncio.iscoroutine(cancel_result):
                await cancel_result

        # Close our local stream iterator so we stop yielding tokens immediately
        if events_iter is not None and hasattr(events_iter, "aclose"):
            await events_iter.aclose()
        if asyncio.iscoroutine(cancel_result):
            await cancel_result
        return True
    except Exception as e:
        logger.error(f"Failed to cancel local result for chat {chat_id}: {e}")
        return False


async def remove_active_result(chat_id: str) -> None:
    """Remove stored Runner result for a chat."""
    active_results.pop(chat_id, None)


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
        await sio.emit(
            "chat_stopped", {"chat_id": str(chat_id), "chat_type": chat_type}, room=sid
        )
        await remove_active_connection(chat_id)
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")


def get_socketio_instance() -> socketio.AsyncServer:
    """Get the global Socket.IO server instance"""
    return sio


# Create a combined lifespan to manage both session managers
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        from app.mcp.server import server  # noqa: E402

        # Initialize Redis client for socket ownership management
        await init_redis_client()

        # Initialize query cache client (depends on Redis)
        await init_query_client()

        # Initialize asyncpg database pool
        await init_db_pool()

        await stack.enter_async_context(server.session_manager.run())

        yield

        # Clean up database pool
        await close_db_pool()

        # Clean up Redis client on shutdown
        await cleanup_redis_client()


# Create FastAPI app
fastapi_app = FastAPI(title="GLOW API", lifespan=lifespan)

# Add CORS middleware FIRST
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Use the same origins as Socket.IO
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (legacy routes removed, all in v2)

# Include API v2 router (analytics)
from app.api.v2.router import router as api_v2_router  # noqa: E402

fastapi_app.include_router(api_v2_router)

# mounting the mcp servers - ensure trailing slashes for proper routing
from app.mcp.server import server  # noqa: E402

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
