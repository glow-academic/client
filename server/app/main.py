# server/app/main.py
import asyncio
import contextlib
import datetime
import json
import logging
import os
import platform
import sys
import time
from collections.abc import AsyncGenerator, AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Any

import asyncpg  # type: ignore
import socketio  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from mcp.server.fastmcp import FastMCP
from starlette.middleware.base import BaseHTTPMiddleware

if TYPE_CHECKING:  # pragma: no cover - runtime import happens lazily
    from redis.asyncio import Redis as RedisClientType
else:  # pragma: no cover - runtime alias for optional dependency

    class RedisClientType(Any):  # type: ignore[misc]
        ...


# Redis is nice in production, but optional in dev
try:
    from socketio import AsyncRedisManager
except ImportError:  # pip install redis-py not present
    AsyncRedisManager = None  # type: ignore

# Guarded Redis import to prevent crashes when redis is not installed
try:
    import redis.asyncio as redis  # type: ignore
except ImportError:
    redis = None  # type: ignore # graceful fallback

load_dotenv()

# Detect container vs. host **without** relying on a .env entry
IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT
UPLOAD_FOLDER = BASE_FOLDER / "uploads"
UPLOAD_FOLDER.mkdir(
    parents=True, exist_ok=True
)  # saving each document as uploads/document_id.ext

# Directory for storing audio uploads
AUDIO_FOLDER = UPLOAD_FOLDER / "audio"
AUDIO_FOLDER.mkdir(parents=True, exist_ok=True)

# Directory for storing image uploads
IMAGE_FOLDER = UPLOAD_FOLDER / "image"
IMAGE_FOLDER.mkdir(parents=True, exist_ok=True)

# Directory for storing video uploads
VIDEO_FOLDER = UPLOAD_FOLDER / "video"
VIDEO_FOLDER.mkdir(parents=True, exist_ok=True)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = UPLOAD_FOLDER / "tus_uploads"
TUS_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

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

# Internal event bus for server-to-server event handling
InternalHandler = Callable[[dict[str, Any]], Awaitable[None]]


class InternalBus:
    """Simple in-process event bus for triggering handlers internally."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[InternalHandler]] = {}

    def on(self, event: str) -> Callable[[InternalHandler], InternalHandler]:
        """Decorator to register a handler for an event."""

        def decorator(fn: InternalHandler) -> InternalHandler:
            self._handlers.setdefault(event, []).append(fn)
            return fn

        return decorator

    async def emit(self, event: str, data: dict[str, Any]) -> None:
        """Emit an event to all registered handlers (fire-and-forget, async)."""
        handlers = self._handlers.get(event, [])
        if not handlers:
            logger.warning(f"[InternalBus] No handlers registered for event: {event}")
            return

        for handler in handlers:
            try:
                await handler(data)
            except Exception as e:
                logger.error(
                    f"[InternalBus] Error in handler for event '{event}': {e}",
                    exc_info=True,
                )


# Singleton internal bus instance
internal_sio = InternalBus()


def get_internal_sio() -> InternalBus:
    """Get the internal event bus instance."""
    return internal_sio


origin = os.getenv("ORIGIN", "http://localhost:3000")
app_prefix = os.getenv("APP_PREFIX", "").strip("/")
socket_path = f"{app_prefix}/socket.io" if app_prefix else "socket.io"

# ---------------------------------------------------------------------------+
# 2.  CORS etc. remains intact                                               +
# ---------------------------------------------------------------------------+
# Allow all origins
allowed_origins = [origin]

# Redis client for shared infrastructure (HTTP caching, health checks, etc.)
redis_client: Any | None = None

# Global in-process store for active Runner results to support immediate cancel
active_results: dict[str, dict[str, Any]] = {}

# Fallback in-memory storage for when Redis is unavailable
socket_owner: dict[str, str] = {}  # profile_id -> socket_id

# Global database connection pool
_db_pool: asyncpg.Pool | None = None
_test_container: Any | None = None

# Global state dictionaries for agent tool results and progress (moved from utils/agents/tools/globals.py)
# Global storage for classification results
classification_results: dict[str, list[str]] = {}
classification_progress: dict[str, bool] = {}

# Default all categories to empty lists
DEFAULT_CATEGORIES = [
    "homeworks",
    "projects",
    "quizzes",
    "midterms",
    "labs",
    "lectures",
    "syllabi",
]


# Global storage for voice sessions (chat_id -> session data)
_voice_sessions: dict[str, dict[str, Any]] = {}

# Global storage for voice message IDs (chat_id -> list of message IDs)
# Accumulates message IDs created during voice tool calls, processed when response.done arrives
_voice_message_ids: dict[str, list[str]] = {}
_voice_message_ids_lock = asyncio.Lock()

# Global storage for simulation tool calls (chat_id -> {tool_call_id: {state...}})
# Tracks tool call state for streaming persona messages from tool call arguments
_simulation_tool_calls: dict[str, dict[str, dict[str, Any]]] = {}



# ----------  Socket.IO with Redis message queue  ----------
redis_url = os.getenv("REDIS_URL")  # don't default when unset
logger.info(f"redis URL {redis_url}")

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


# Wrapper functions to access shared state (avoids circular dependencies)
# These are defined after sio is created so they can reference it
def get_redis_client() -> Any | None:
    """Get the Redis client instance."""
    return redis_client


def get_socket_owner_dict() -> dict[str, str]:
    """Get the socket owner dictionary."""
    return socket_owner


def get_active_results_dict() -> dict[str, dict[str, Any]]:
    """Get the active results dictionary."""
    return active_results


def get_simulation_tool_calls_dict() -> dict[str, dict[str, dict[str, Any]]]:
    """Get the simulation tool calls dictionary."""
    return _simulation_tool_calls


# Global storage for tool call locks (chat_id -> {call_id -> Lock})
_simulation_tool_calls_locks: dict[str, dict[str, asyncio.Lock]] = {}


def get_simulation_tool_calls_locks() -> dict[str, dict[str, asyncio.Lock]]:
    """Get the simulation tool calls locks dictionary."""
    return _simulation_tool_calls_locks


# Global storage for voice speech started timestamps (chat_id -> {item_id -> datetime})
_voice_speech_timestamps: dict[str, dict[str, datetime.datetime]] = {}
_voice_speech_timestamps_lock = asyncio.Lock()


def get_voice_speech_timestamps() -> dict[str, dict[str, datetime.datetime]]:
    """Get the voice speech timestamps dictionary."""
    return _voice_speech_timestamps


def get_voice_speech_timestamps_lock() -> asyncio.Lock:
    """Get the voice speech timestamps lock."""
    return _voice_speech_timestamps_lock


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance."""
    return sio




def get_pool() -> asyncpg.Pool | None:
    """Get the global connection pool (for WebSocket handlers)."""
    return _db_pool


async def init_db_pool() -> None:
    """Initialize asyncpg connection pool."""
    global _db_pool, _test_container

    env_value = os.getenv("ENV", "")
    env_name = env_value.upper()

    if env_name == "TEST":
        print("🐳 TEST mode detected: starting disposable Postgres with Testcontainers")
        from testcontainers.postgres import \
            PostgresContainer  # type: ignore[import]

        _test_container = PostgresContainer("postgres:18")
        _test_container.start()

        raw_url = _test_container.get_connection_url()
        db_url = raw_url.replace("postgresql+psycopg2://", "postgresql://")

        pool_config = {
            "min_size": 1,
            "max_size": 5,
        }

        _db_pool = await asyncpg.create_pool(db_url, **pool_config)
        print(f"✅ Using test database at {db_url}")

        schema_path = (
            Path(__file__).resolve().parent.parent.parent / "database" / "schema.sql"
        )
        if not schema_path.exists():
            raise FileNotFoundError(
                f"Schema file not found at {schema_path}. \n"
                "Generate it with 'make export-db schema'."
            )

        schema_sql = schema_path.read_text()
        # Filter out pg_dump meta-commands (lines starting with \) that can't be executed via asyncpg
        # These are psql meta-commands, not SQL
        filtered_sql = "\n".join(
            line for line in schema_sql.split("\n")
            if not line.strip().startswith("\\")
        )
        async with _db_pool.acquire() as conn:
            await conn.execute(filtered_sql)
        print("🗄️  Test schema applied to disposable database")
        return

    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    db_port = os.getenv("DB_PORT")
    db_host = os.getenv("DB_HOST")

    # Construct the database URL
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    if not all([db_user, db_password, db_name, db_port, db_host]):
        raise ValueError("Database configuration is incomplete")

    # Detect if we're connecting through PgBouncer
    # PgBouncer pool mode determines if we can use prepared statements:
    # - transaction mode: requires disabling prepared statements
    # - session mode: can use prepared statements (better for long queries)
    using_pgbouncer = db_host == "pgbouncer"
    pgbouncer_pool_mode = os.getenv("PGPOOL_MODE", "transaction").lower()

    print(f"🔌 Initializing asyncpg connection pool to {db_host}:{db_port}/{db_name}")

    pool_config = {
        "min_size": 10,
        "max_size": 100,  # High capacity for concurrent analytics + background refresh
        "command_timeout": 60,  # Allow time for complex analytics queries (cold cache)
        "max_queries": 50000,  # Limit queries per connection before recycling
        "max_inactive_connection_lifetime": 300,  # 5 minutes
    }

    # Note: When using PgBouncer in production:
    # - Transaction mode: Set PGPOOL_MODE=transaction (requires disabling prepared statements)
    # - Session mode: Set PGPOOL_MODE=session (allows prepared statements, better for long queries)
    # - Configure PgBouncer: default_pool_size=25, max_client_conn=200
    # - This gives you: 100 app connections -> PgBouncer -> 25 DB connections
    # - Reduces DB connection overhead while maintaining app concurrency

    # Disable prepared statements only for PgBouncer transaction mode
    # Session mode allows prepared statements which significantly improves performance
    if using_pgbouncer and pgbouncer_pool_mode == "transaction":
        pool_config["statement_cache_size"] = 0
        print(
            "   ⚙️  PgBouncer detected (transaction mode): Disabling prepared statements for compatibility"
        )
    elif using_pgbouncer and pgbouncer_pool_mode == "session":
        # Session mode allows prepared statements - use default cache size
        print(
            "   ⚙️  PgBouncer detected (session mode): Using prepared statements for better performance"
        )
    else:
        print(
            "   ⚙️  Direct connection: Using prepared statements for better performance"
        )

    _db_pool = await asyncpg.create_pool(db_url, **pool_config)
    print("✅ Database pool initialized")


async def close_db_pool() -> None:
    """Close asyncpg connection pool."""
    global _db_pool, _test_container
    if _db_pool:
        print("🔌 Closing database pool...")
        await _db_pool.close()
        _db_pool = None
        print("✅ Database pool closed")

    if _test_container:
        print("🐳 Stopping test database container...")
        _test_container.stop()
        _test_container = None
        print("✅ Test database container stopped")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Dependency for FastAPI endpoints to get database connection."""
    if not _db_pool:
        raise RuntimeError("Database pool not initialized")

    async with _db_pool.acquire() as connection:
        yield connection


@asynccontextmanager
async def transaction(
    conn: asyncpg.Connection,
) -> AsyncGenerator[asyncpg.Connection, None]:
    """Simple transaction context manager.

    Usage:
        async with transaction(conn):
            await conn.execute(query1, *params1)
            await conn.execute(query2, *params2)
            # Commits on success, rolls back on exception
    """
    tr = conn.transaction()
    await tr.start()
    try:
        yield conn
        await tr.commit()
    except Exception:
        await tr.rollback()
        raise


from app.socket.v3.simulations.document_template_create import \
    document_template_create_internal  # noqa: F401
# Import WebSocket handlers after sio is created to avoid circular imports
# Handlers use @sio.event decorators directly - no registration needed
from app.socket.v3.agents.image.complete import \
    image_generation_complete  # noqa: F401
# Import image modules to register internal_sio handlers
from app.socket.v3.agents.image.generate import generate_image  # noqa: F401
# Import log module to register internal_sio handler
from app.socket.v3.log import log_run  # noqa: F401
# Import quiz handlers
# Note: Quiz events removed - questions now handled through scenarios
# Import scenario tools to register internal_sio handlers
from app.socket.v3.tools.document.call import \
    scenario_tool_document  # noqa: F401
from app.socket.v3.tools.image.call import \
    scenario_tool_image  # noqa: F401
from app.socket.v3.tools.objectives.call import \
    scenario_tool_objectives  # noqa: F401
from app.socket.v3.tools.questions.call import \
    scenario_tool_questions  # noqa: F401
from app.socket.v3.tools.title_description.call import \
    scenario_tool_problem_statement  # noqa: F401
# Import scenario tools to register internal_sio handlers
from app.socket.v3.tools.video.call import \
    scenario_tool_video  # noqa: F401
from app.socket.v3.simulations.group.link import \
    simulation_group_link_internal  # noqa: F401
from app.socket.v3.simulations.hint_create import \
    simulation_hints_create_internal  # noqa: F401
# Import simulation hints to register internal_sio handler
from app.socket.v3.agents.hint.generate import \
    simulation_hints_generate_internal  # noqa: F401
from app.socket.v3.simulations.message.create import \
    simulation_message_create_internal  # noqa: F401

# Export IMAGE_FOLDER for use in other modules
__all__ = ["IMAGE_FOLDER"]


# Create a combined lifespan to manage both session managers
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        # Configure uvicorn loggers to use compact format (after uvicorn has initialized)
        compact_formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
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

        # Configure Socket.IO loggers to prevent propagation to root logger
        # This prevents duplicate log entries (Socket.IO logs + root logger formatted logs)
        for logger_name in [
            "socketio",
            "engineio",
            "socketio.server",
            "engineio.server",
        ]:
            socketio_logger = logging.getLogger(logger_name)
            socketio_logger.propagate = False  # Prevent double logging
            # Update existing handlers or add new one
            if socketio_logger.handlers:
                for handler in socketio_logger.handlers:
                    handler.setFormatter(compact_formatter)
            else:
                handler = logging.StreamHandler()
                handler.setFormatter(compact_formatter)
                socketio_logger.addHandler(handler)

        # Initialize Redis client for HTTP caching and socket ownership management
        global redis_client
        redis_url = os.getenv("REDIS_URL")
        logger.info(
            f"Initializing HTTP cache Redis client: redis={redis is not None}, redis_url={redis_url}"
        )
        if not redis or not redis_url:
            logger.warning(
                "Redis disabled (no lib or no REDIS_URL); using in-memory fallbacks"
            )
            redis_client = None
        else:
            try:
                client = redis.from_url(redis_url)  # type: ignore
                await client.ping()
                redis_client = client
                logger.info(f"Redis client initialized for HTTP caching: {redis_url}")
            except Exception as e:
                logger.error(f"Failed to initialize Redis client: {e}", exc_info=True)
                redis_client = None

        # Initialize asyncpg database pool
        await init_db_pool()

        pool = get_pool()
        if pool:
            # Setup activity logger
            from app.infra.v3.activity.logger import \
                setup_activity_logger  # noqa: E402

            setup_activity_logger(pool)
            logger.info("Activity logger initialized")

            # Keycloak sync moved to app.socket.v3.actions.keycloak
            # Sync is triggered via WebSocket events and after auth mutations

        # Initialize metrics collector
        from app.infra.v3.metrics.collector import \
            initialize_metrics  # noqa: E402

        if pool:
            await initialize_metrics(pool, redis_client)
            logger.info("Metrics collector initialized")
            logger.info(
                "Metrics snapshot and health logging now handled by notify service"
            )

        await stack.enter_async_context(server.session_manager.run())

        # Generate OpenAPI schema and write to disk
        schema = get_openapi(
            title=app.title,
            version="0.1.0",
            routes=app.routes,
            description="Auto-generated OpenAPI schema from FastAPI v3 API",
        )

        # Add x-cache-tags extension to each operation based on tags
        for _path, path_item in schema.get("paths", {}).items():
            for _method, operation in path_item.items():
                if isinstance(operation, dict) and "tags" in operation:
                    # Use tags as cache tags (store all tags)
                    tags = operation.get("tags", [])
                    if tags:
                        operation["x-cache-tags"] = tags

        openapi_path = Path(__file__).parent.parent / "openapi.json"
        openapi_path.write_text(json.dumps(schema, indent=2))
        logger.info(f"✅ OpenAPI schema written to {openapi_path}")

        # Note: Socket event types are now extracted from OpenAPI schema via TypeScript type introspection
        # No need to generate ws.json - socket events are already in openapi.json via FastAPI routers

        yield

        # Clean up database pool
        await close_db_pool()

        # Clean up Redis client on shutdown
        if redis_client:
            await redis_client.close()
            redis_client = None
            logger.info("Redis client closed")


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


# Database logging middleware (after CORS)
# Inlined from middleware/db_logging.py to follow DHH principles - minimal abstractions
class DBLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that automatically logs all requests/responses to database."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process request and log to database."""
        from app.infra.v3.metrics.collector import record_error, record_request
        from utils.logging.db_logger import get_logger, set_profile_id

        logger = get_logger(__name__)
        start_time = time.perf_counter()

        # Extract profile_id from request
        profile_id: str | None = None

        # Try to get from request body if JSON
        # Skip JSON parsing for TUS uploads and other binary content types
        content_type = request.headers.get("Content-Type", "")
        is_binary_content = (
            content_type == "application/offset+octet-stream"  # TUS uploads
            or content_type.startswith("multipart/")  # File uploads
            or content_type.startswith("image/")  # Direct image uploads
            or content_type.startswith("video/")  # Direct video uploads
            or content_type.startswith("audio/")  # Direct audio uploads
        )

        if request.method in ("POST", "PUT", "PATCH") and not is_binary_content:
            try:
                body = await request.body()
                if body:
                    body_json = json.loads(body)
                    # Common patterns: profileId, profile_id, actualProfileId, effectiveProfileId
                    profile_id = (
                        body_json.get("profileId")
                        or body_json.get("profile_id")
                        or body_json.get("actualProfileId")
                        or body_json.get("effectiveProfileId")
                    )
            except (json.JSONDecodeError, UnicodeDecodeError, KeyError, AttributeError):
                pass

        # Check if profile_id was already set by router-level dependency
        # (dependency runs after middleware, but we check state here for consistency)
        if hasattr(request.state, "profile_id") and request.state.profile_id:
            profile_id = request.state.profile_id
        else:
            # Try to get from headers (fallback for non-v3 routes or before dependency runs)
            if not profile_id:
                profile_id = request.headers.get("X-Profile-Id")

        # Set profile_id if found, otherwise skip DB logging
        # Note: We do NOT resolve from department-id/auth-mode cookies here
        # Only /api/v3/profile/context resolves from cookies (single source of truth)
        if profile_id:
            set_profile_id(profile_id)
        else:
            # No profile_id available, skip DB logging
            set_profile_id(None)

        # Process request
        status_code = 500
        error_msg: str | None = None
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception as exc:
            status_code = 500
            error_msg = str(exc)
            raise
        finally:
            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Record metrics (async, fire and forget)
            try:
                import asyncio

                if status_code >= 500:
                    asyncio.create_task(record_error())
                asyncio.create_task(record_request(duration_ms))
            except Exception:
                pass  # Don't break request if metrics fail

            # Log activity to database (fire and forget - don't block response)
            try:
                from app.infra.v3.activity.logger import log_activity
                from utils.logging.db_logger import profile_id_context

                # Get resolved profile_id for activity logging
                resolved_profile_id = profile_id_context.get(None)
                if resolved_profile_id:
                    # Log activity if audit intent is present
                    asyncio.create_task(
                        log_activity(
                            request, status_code, duration_ms, resolved_profile_id
                        )
                    )
            except Exception:
                # Never break the request because logging failed
                pass
            finally:
                # Clear profile_id from context
                set_profile_id(None)


fastapi_app.add_middleware(DBLoggingMiddleware)

# Include routers

# Include API v3 router (DHH-style)
from app.api.v3.router import router as api_v3_router  # noqa: E402

fastapi_app.include_router(api_v3_router)

# Include socket v3 router (DHH-style)
from app.socket.v3 import router as socket_router  # noqa: E402

fastapi_app.include_router(socket_router)

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
async def health_services() -> JSONResponse:
    """Rich health endpoint for dashboard.

    Returns per-service status + latencies.
    Automatically logs health checks to database when called by notify service.
    """
    from app.infra.v3.health import run_service_checks
    from app.infra.v3.metrics.collector import log_health_checks

    checks = await run_service_checks()

    # Log health checks to database (non-blocking, fire-and-forget)
    try:
        asyncio.create_task(log_health_checks())
    except Exception:
        # Don't fail health endpoint if logging fails
        pass

    # Convert ServiceCheckResult dataclasses to dicts
    services = {
        service: {
            "ok": result.ok,
            "latency_ms": result.latency_ms,
            "error": result.error,
        }
        for service, result in checks.items()
    }

    # Determine overall status
    overall_ok = all(result.ok for result in checks.values())
    status = "ok" if overall_ok else "degraded"

    return JSONResponse(
        content={
            "status": status,
            "services": services,
        }
    )


@fastapi_app.post("/metrics/snapshot")
async def metrics_snapshot() -> JSONResponse:
    """Trigger metrics snapshot to database.

    Called by notify service to log metrics snapshot.
    No leader election needed since notify service is single instance.
    """
    from app.infra.v3.metrics.collector import log_metrics_snapshot

    try:
        await log_metrics_snapshot()
        return JSONResponse(
            content={
                "success": True,
                "message": "Metrics snapshot logged",
            }
        )
    except Exception as e:
        from utils.logging.db_logger import get_logger

        logger = get_logger("app.main")
        logger.error(f"Error logging metrics snapshot: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Failed to log metrics snapshot: {str(e)}",
            },
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
