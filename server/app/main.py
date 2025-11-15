# server/app/main.py
import contextlib
import json
import logging
import os
import platform
import sys
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import socketio  # type: ignore
from app.db import close_db_pool, init_db_pool
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from mcp.server.fastmcp import FastMCP

# Redis is nice in production, but optional in dev
try:
    from socketio import AsyncRedisManager
except ImportError:  # pip install redis-py not present
    AsyncRedisManager = None  # type: ignore

load_dotenv()

# MCP server instance for tool registration
server = FastMCP("Domain-API", stateless_http=True)

# Configure logging first - compact format to reduce whitespace
# Use basicConfig with force=True to override uvicorn's default logging (Python 3.8+)
# This ensures compact format is applied before uvicorn sets up its loggers
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,  # Override any existing configuration
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

# Import Redis client initialization from extensions
from app.extensions import cleanup_redis_client, init_redis_client

# Store active chat connections - now using Redis
# active_connections: dict[str, str] = {}  # REMOVED - using Redis instead

# Profile-based connection management (simplified) - now using Redis
# socket_owner: Dict[str, str] = {}  # profile_id -> socket_id - REMOVED, using Redis

# Track guest connections without restricting concurrency - now using Redis
# guest_connection_count: int = 0 - REMOVED, using Redis
# guest_sids: set[str] = set() - REMOVED, using Redis


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

# Import WebSocket handlers after sio is created to avoid circular imports
# Handlers use @sio.event decorators directly - no registration needed
from app.socket.assistants import send_assistant_message  # type: ignore
from app.socket.assistants import start_assistant  # type: ignore
from app.socket.assistants import stop_assistant  # type: ignore
from app.socket.connections import connect  # type: ignore
from app.socket.connections import disconnect  # type: ignore
from app.socket.connections import join_chat  # type: ignore
from app.socket.connections import leave_chat  # type: ignore
from app.socket.connections import stop_chat  # type: ignore
from app.socket.simulations import send_simulation_message  # type: ignore
from app.socket.simulations import start_simulation  # type: ignore
from app.socket.simulations import stop_simulation  # type: ignore


# Create a combined lifespan to manage both session managers
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        # Configure uvicorn loggers to use compact format (after uvicorn has initialized)
        compact_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
            uvicorn_logger = logging.getLogger(logger_name)
            uvicorn_logger.propagate = False  # Prevent double logging
            # Update existing handlers or add new one
            if uvicorn_logger.handlers:
                for handler in uvicorn_logger.handlers:
                    handler.setFormatter(compact_formatter)
            else:
                handler = logging.StreamHandler()
                handler.setFormatter(compact_formatter)
                uvicorn_logger.addHandler(handler)
        
        # Initialize Redis client for socket ownership management
        await init_redis_client()

        # Initialize asyncpg database pool
        await init_db_pool()

        await stack.enter_async_context(server.session_manager.run())

        # Generate OpenAPI schema and write to disk
        schema = get_openapi(
            title=app.title,
            version="0.1.0",
            routes=app.routes,
            description="Auto-generated OpenAPI schema from FastAPI v3 API",
        )
        
        # Add x-cache-tags extension to each operation based on tags
        for path, path_item in schema.get("paths", {}).items():
            for method, operation in path_item.items():
                if isinstance(operation, dict) and "tags" in operation:
                    # Use tags as cache tags (store all tags)
                    tags = operation.get("tags", [])
                    if tags:
                        operation["x-cache-tags"] = tags
        
        openapi_path = Path(__file__).parent.parent / "openapi.json"
        openapi_path.write_text(json.dumps(schema, indent=2))
        logger.info(f"✅ OpenAPI schema written to {openapi_path}")

        yield

        # Clean up database pool
        await close_db_pool()

        # Clean up Redis client on shutdown
        await cleanup_redis_client()


# Create FastAPI app
# redirect_slashes=False prevents automatic redirects between /path and /path/
# This avoids double-slash issues when clients call paths inconsistently
fastapi_app = FastAPI(title="GLOW API", lifespan=lifespan)

# Add CORS middleware FIRST
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Use the same origins as Socket.IO
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers

# Include API v3 router (DHH-style)
from app.api.v3.router import router as api_v3_router  # noqa: E402

fastapi_app.include_router(api_v3_router)

# mounting the mcp servers - ensure trailing slashes for proper routing
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
