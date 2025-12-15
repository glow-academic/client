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

# Request-scoped storage instances (initialized in lifespan)
# These replace the old global dictionaries for multi-tenant safety
scenario_storage: Any | None = None
question_storage: Any | None = None
outline_storage: Any | None = None
grading_storage: Any | None = None
hint_storage: Any | None = None
image_generation_storage: Any | None = None
dynamic_document_storage: Any | None = None

# Global storage for voice sessions (chat_id -> session data)
_voice_sessions: dict[str, dict[str, Any]] = {}

# Global storage for voice message IDs (chat_id -> list of message IDs)
# Accumulates message IDs created during voice tool calls, processed when response.done arrives
_voice_message_ids: dict[str, list[str]] = {}

# Global storage for simulation tool calls (chat_id -> {tool_call_id: {state...}})
# Tracks tool call state for streaming persona messages from tool call arguments
_simulation_tool_calls: dict[str, dict[str, dict[str, Any]]] = {}

# Cached guest profile UUID (initialized at startup)
_guest_profile_id: str | None = None


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


def get_voice_speech_timestamps() -> dict[str, dict[str, datetime.datetime]]:
    """Get the voice speech timestamps dictionary."""
    return _voice_speech_timestamps


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance."""
    return sio


# Storage getter functions (backward compatibility)
def get_scenario_storage() -> Any:
    """Get the scenario generation storage instance."""
    if scenario_storage is None:
        raise RuntimeError(
            "Scenario storage not initialized. Call initialize_storage() at startup."
        )
    return scenario_storage


def get_question_storage() -> Any:
    """Get the question generation storage instance."""
    if question_storage is None:
        raise RuntimeError(
            "Question storage not initialized. Call initialize_storage() at startup."
        )
    return question_storage


def get_outline_storage() -> Any:
    """Get the outline generation storage instance."""
    if outline_storage is None:
        raise RuntimeError(
            "Outline storage not initialized. Call initialize_storage() at startup."
        )
    return outline_storage


def get_grading_storage() -> Any:
    """Get the grading storage instance."""
    if grading_storage is None:
        raise RuntimeError(
            "Grading storage not initialized. Call initialize_storage() at startup."
        )
    return grading_storage


def get_hint_storage() -> Any:
    """Get the hint storage instance."""
    if hint_storage is None:
        raise RuntimeError(
            "Hint storage not initialized. Call initialize_storage() at startup."
        )
    return hint_storage


def get_image_generation_storage() -> Any:
    """Get the image generation storage instance."""
    if image_generation_storage is None:
        raise RuntimeError(
            "Image generation storage not initialized. Call initialize_storage() at startup."
        )
    return image_generation_storage


def get_dynamic_document_storage() -> Any:
    """Get the dynamic document storage instance."""
    if dynamic_document_storage is None:
        raise RuntimeError(
            "Dynamic document storage not initialized. Call initialize_storage() at startup."
        )
    return dynamic_document_storage


def get_pool() -> asyncpg.Pool | None:
    """Get the global connection pool (for WebSocket handlers)."""
    return _db_pool


def get_guest_profile_id() -> str:
    """Get the cached guest profile UUID.

    Returns:
        Guest profile UUID string (never null, may be placeholder if not initialized)

    Raises:
        RuntimeError: If guest profile has not been initialized
    """
    if _guest_profile_id is None:
        raise RuntimeError(
            "Guest profile UUID not initialized. Call initialize_guest_profile() at startup."
        )
    return _guest_profile_id


def resolve_profile_id(profile_id: str | None) -> str:
    """Resolve 'guest-profile-id' to actual guest UUID using cached value.

    Args:
        profile_id: Profile ID string, may be "guest-profile-id", None, or actual UUID

    Returns:
        Resolved UUID string (never null)

    Raises:
        RuntimeError: If guest profile has not been initialized
    """
    if not profile_id or profile_id == "guest-profile-id":
        return get_guest_profile_id()

    return profile_id


async def init_db_pool() -> None:
    """Initialize asyncpg connection pool."""
    global _db_pool, _test_container

    env_value = os.getenv("ENV", "")
    env_name = env_value.upper()

    if env_name == "TEST":
        print("🐳 TEST mode detected: starting disposable Postgres with Testcontainers")
        from testcontainers.postgres import PostgresContainer  # type: ignore[import]

        _test_container = PostgresContainer("postgres:16")
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
            Path(__file__).resolve().parent.parent / "tests" / "test-schema.sql"
        )
        if not schema_path.exists():
            raise FileNotFoundError(
                f"Test schema file not found at {schema_path}. \n"
                "Generate it with 'make generate-test-schema'."
            )

        schema_sql = schema_path.read_text()
        async with _db_pool.acquire() as conn:
            await conn.execute(schema_sql)
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


# Import WebSocket handlers after sio is created to avoid circular imports
# Handlers use @sio.event decorators directly - no registration needed
from app.socket.connect import connect  # type: ignore
from app.socket.disconnect import disconnect  # type: ignore
from app.socket.documents.generate import document_generate  # noqa: E402; type: ignore
from app.socket.images.complete import image_generation_complete  # noqa: F401

# Import image modules to register internal_sio handlers
from app.socket.images.generate import generate_image  # noqa: F401

# Import log module to register internal_sio handler
from app.socket.log import log_run  # noqa: F401

# Import quiz handlers
# Note: Quiz events removed - questions now handled through scenarios
from app.socket.scenarios.generate import generate_scenario  # noqa: E402; type: ignore

# Import scenario tools to register internal_sio handlers
from app.socket.scenarios.tools.document import scenario_tool_document  # noqa: F401
from app.socket.scenarios.tools.image import scenario_tool_image  # noqa: F401
from app.socket.scenarios.tools.objectives import scenario_tool_objectives  # noqa: F401
from app.socket.scenarios.tools.questions import scenario_tool_questions  # noqa: F401
from app.socket.scenarios.tools.statement import (
    scenario_tool_problem_statement,  # noqa: F401
)

# Import scenario tools to register internal_sio handlers
from app.socket.scenarios.tools.video import scenario_tool_video  # noqa: F401
from app.socket.simulations import (
    simulation_join,  # type: ignore
    simulation_leave,
)
from app.socket.simulations.text.end import (
    simulation_text_end,  # noqa: E402; type: ignore
)
from app.socket.simulations.text.next import (
    simulation_text_next,  # noqa: E402; type: ignore
)
from app.socket.simulations.text.practice import (
    simulation_text_practice,  # noqa: E402; type: ignore
)
from app.socket.simulations.text.send import (
    simulation_text_send,  # noqa: E402; type: ignore
)
from app.socket.simulations.text.start import (
    simulation_text_start,  # noqa: E402; type: ignore
)
from app.socket.simulations.text.stop import (
    simulation_text_stop,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.assistant.delta import (
    simulation_voice_assistant_delta,
)  # noqa: E402; type: ignore
from app.socket.simulations.voice.assistant.done import (
    simulation_voice_assistant_done,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.assistant.interrupted import (
    simulation_voice_assistant_interrupted,
)  # noqa: E402; type: ignore
from app.socket.simulations.voice.debug import (
    simulation_voice_debug_info,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.start import (
    simulation_voice_start,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.stop import (
    simulation_voice_stop,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.user.delta import (
    simulation_voice_user_delta,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.user.speech import (
    simulation_voice_user_speech,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.user.start import (
    simulation_voice_user_start,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.user.text import (
    simulation_voice_user_text,  # noqa: E402; type: ignore
)
from app.socket.simulations.voice.user.transcript import (
    simulation_voice_user_transcript,
)  # noqa: E402; type: ignore

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

        # Initialize request-scoped storage instances
        global scenario_storage, question_storage, outline_storage
        global \
            grading_storage, \
            hint_storage, \
            image_generation_storage, \
            dynamic_document_storage
        from app.utils.storage.request_storage import create_request_storage

        storage = create_request_storage(redis_client, ttl_seconds=3600)
        scenario_storage = storage
        question_storage = storage
        outline_storage = storage
        grading_storage = storage
        hint_storage = storage
        image_generation_storage = storage
        dynamic_document_storage = storage
        logger.info("Request-scoped storage initialized (Redis-backed if available)")

        # Initialize asyncpg database pool
        await init_db_pool()

        # Initialize database logger
        from app.utils.logging.db_logger import setup_db_logger  # noqa: E402

        pool = get_pool()
        if pool:
            # Initialize cached guest profile UUID
            global _guest_profile_id
            try:
                async with pool.acquire() as conn:
                    result = await conn.fetchval(
                        """
                        SELECT sdg.profile_id::text
                        FROM settings_default_guest sdg
                        JOIN settings s ON s.id = sdg.settings_id AND s.active = true
                        WHERE sdg.active = true
                        LIMIT 1
                        """
                    )

                    if result:
                        _guest_profile_id = str(result)
                        logger.info(
                            f"✅ Cached guest profile UUID: {_guest_profile_id}"
                        )
                    else:
                        # Fallback to placeholder if no guest profile found
                        _guest_profile_id = "00000000-0000-0000-0000-000000000000"
                        logger.warning(
                            "⚠️  No default guest profile found in database; using placeholder UUID"
                        )
            except Exception as e:
                logger.error(f"Error initializing guest profile: {e}", exc_info=True)
                # Fallback to placeholder on error
                _guest_profile_id = "00000000-0000-0000-0000-000000000000"

            setup_db_logger(pool)
            logger.info("Database logger initialized")

            # Add DBLogHandler to Socket.IO loggers so they write to database
            from app.utils.logging.db_logger import DBLogHandler  # noqa: E402

            for logger_name in [
                "socketio",
                "engineio",
                "socketio.server",
                "engineio.server",
            ]:
                socketio_logger = logging.getLogger(logger_name)
                # Only add DBLogHandler if not already present
                if not any(
                    isinstance(h, DBLogHandler) for h in socketio_logger.handlers
                ):
                    db_handler = DBLogHandler()
                    db_handler.setLevel(logging.DEBUG)
                    socketio_logger.addHandler(db_handler)

            # Sync Keycloak identity providers from database
            try:
                # Keycloak sync configuration
                # Construct Keycloak URL: if KEYCLOAK_URL is explicitly set, use it;
                # otherwise, construct from APP_PREFIX to match Makefile configuration
                app_prefix = os.getenv("APP_PREFIX", "")
                explicit_keycloak_url = os.getenv("KEYCLOAK_URL")
                if explicit_keycloak_url:
                    keycloak_url = explicit_keycloak_url.rstrip("/")
                else:
                    # Match Makefile: KC_HTTP_RELATIVE_PATH=${APP_PREFIX}/auth
                    base_url = "http://localhost:8080"
                    keycloak_url = f"{base_url}{app_prefix}/auth"
                keycloak_admin = os.getenv("KEYCLOAK_ADMIN", "admin")
                keycloak_admin_password = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
                keycloak_realm = os.getenv("KEYCLOAK_REALM", "glow")

                # Retry configuration
                MAX_RETRIES = 10
                INITIAL_RETRY_DELAY = 2.0  # seconds
                MAX_RETRY_DELAY = 30.0  # seconds

                # Helper function to wait for Keycloak
                async def wait_for_keycloak(
                    url: str,
                    admin: str,
                    password: str,
                    max_retries: int = MAX_RETRIES,
                ) -> Any | None:
                    """Wait for Keycloak to be ready and return a connected KeycloakAdmin instance."""
                    try:
                        from keycloak import KeycloakAdmin  # type: ignore
                    except ImportError:
                        logger.warning(
                            "keycloak package not installed, skipping Keycloak sync"
                        )
                        return None

                    retry_delay = INITIAL_RETRY_DELAY

                    for attempt in range(1, max_retries + 1):
                        try:
                            logger.info(
                                f"Attempting to connect to Keycloak (attempt {attempt}/{max_retries})..."
                            )
                            # Disable SSL verification for non-production environments
                            # Check if ORIGIN contains localhost (dev) vs real domain (prod)
                            origin_check = os.getenv("ORIGIN", "http://localhost:3000")
                            is_prod = "localhost" not in origin_check.lower()
                            verify_ssl = is_prod  # Only verify SSL in production

                            kc_admin = KeycloakAdmin(
                                server_url=f"{url}/",
                                username=admin,
                                password=password,
                                realm_name="master",
                                verify=verify_ssl,
                            )
                            # Test the connection by getting realms
                            kc_admin.get_realms()
                            logger.info("✅ Successfully connected to Keycloak")
                            return kc_admin
                        except Exception as e:
                            if attempt < max_retries:
                                logger.warning(
                                    f"Keycloak not ready yet (attempt {attempt}/{max_retries}): {e}. "
                                    f"Retrying in {retry_delay:.1f}s..."
                                )
                                await asyncio.sleep(retry_delay)
                                # Exponential backoff with cap
                                retry_delay = min(retry_delay * 1.5, MAX_RETRY_DELAY)
                            else:
                                logger.error(
                                    f"Failed to connect to Keycloak after {max_retries} attempts: {e}"
                                )
                                return None

                    return None

                # Connect to Keycloak Admin API with retry logic
                kc_admin = await wait_for_keycloak(
                    keycloak_url, keycloak_admin, keycloak_admin_password
                )
                if not kc_admin:
                    logger.warning(
                        "Keycloak is not available. Skipping sync. "
                        "The server will continue to run, but authentication may not work until Keycloak is ready."
                    )
                else:
                    # Update master realm SSL setting for local development
                    try:
                        # Check if ORIGIN contains localhost (dev) vs real domain (prod)
                        origin_check = os.getenv("ORIGIN", "http://localhost:3000")
                        is_local_dev = "localhost" in origin_check.lower()

                        if is_local_dev:
                            master_realm = kc_admin.get_realm("master")
                            current_ssl_required = master_realm.get(
                                "sslRequired", "EXTERNAL"
                            )
                            if current_ssl_required != "NONE":
                                kc_admin.update_realm(
                                    realm_name="master",
                                    payload={"sslRequired": "NONE"},
                                )
                                logger.info(
                                    f"✅ Master realm SSL requirement disabled for local development (was: {current_ssl_required})"
                                )
                    except Exception as e:
                        logger.warning(
                            f"Could not update master realm SSL setting: {e}. Continuing..."
                        )

                    # Ensure the target realm exists (create if it doesn't)
                    try:
                        realms = kc_admin.get_realms()
                        realm_exists = any(r["realm"] == keycloak_realm for r in realms)
                        if not realm_exists:
                            logger.info(f"Creating Keycloak realm: {keycloak_realm}")
                            kc_admin.create_realm(
                                payload={
                                    "realm": keycloak_realm,
                                    "enabled": True,
                                },
                                skip_exists=True,
                            )
                            logger.info(f"✅ Realm '{keycloak_realm}' created")
                        else:
                            logger.info(f"✅ Realm '{keycloak_realm}' already exists")
                    except Exception as e:
                        logger.error(
                            f"Failed to ensure realm exists: {e}", exc_info=True
                        )
                        kc_admin = None

                    if kc_admin:
                        # Switch to target realm
                        kc_admin.change_current_realm(realm_name=keycloak_realm)

                        # Fix realm settings for local development
                        try:
                            realm_details = kc_admin.get_realm(keycloak_realm)
                            attributes = realm_details.get("attributes", {})
                            current_frontend_url = attributes.get("frontendUrl", "")
                            current_ssl_required = realm_details.get(
                                "sslRequired", "EXTERNAL"
                            )

                            # Check if ORIGIN contains localhost (dev) vs real domain (prod)
                            origin_check = os.getenv("ORIGIN", "http://localhost:3000")
                            is_local_dev = "localhost" in origin_check.lower()

                            needs_update = False
                            update_payload: dict[str, Any] = {}

                            # Fix frontend URL if needed
                            if (
                                current_frontend_url
                                and "/realms/" in current_frontend_url
                            ):
                                update_payload["attributes"] = {
                                    **attributes,
                                    "frontendUrl": "",
                                }
                                needs_update = True
                                logger.info(
                                    f"Fixing realm frontend URL (was: {current_frontend_url})"
                                )
                            elif (
                                not current_frontend_url
                                and update_payload.get("attributes") is None
                            ):
                                update_payload["attributes"] = attributes

                            # Disable SSL requirement for local development
                            if is_local_dev and current_ssl_required != "NONE":
                                if "attributes" not in update_payload:
                                    update_payload["attributes"] = attributes
                                update_payload["sslRequired"] = "NONE"
                                needs_update = True
                                logger.info(
                                    f"Disabling SSL requirement for local development (was: {current_ssl_required})"
                                )

                            if needs_update:
                                kc_admin.update_realm(
                                    realm_name=keycloak_realm,
                                    payload=update_payload,
                                )
                                logger.info("✅ Realm settings updated")
                            else:
                                logger.info("✅ Realm settings are already correct")
                        except Exception as e:
                            logger.warning(
                                f"Could not update realm settings: {e}. Continuing..."
                            )

                        # Setup Next.js client with pre-shared secret
                        target_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
                        target_secret: str | None = os.getenv("AUTH_KEYCLOAK_SECRET")
                        client_port = os.getenv("CLIENT_PORT", "3000")
                        # app_prefix already defined earlier in Keycloak sync configuration

                        if not target_secret:
                            logger.warning(
                                "⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot enforce DHH-style auth."
                            )
                        else:
                            try:
                                # Build redirect URIs using ORIGIN (respects nginx/APP_PREFIX)
                                origin = os.getenv(
                                    "ORIGIN", f"http://localhost:{client_port}"
                                )
                                base_url = origin.rstrip("/")
                                redirect_uri = (
                                    f"{base_url}{app_prefix}/api/auth/callback/keycloak"
                                )
                                redirect_uris = [
                                    redirect_uri,
                                    f"{base_url}{app_prefix}/*",
                                ]

                                # Check if client exists
                                clients = kc_admin.get_clients()
                                existing_client = next(
                                    (
                                        c
                                        for c in clients
                                        if c.get("clientId") == target_client_id
                                    ),
                                    None,
                                )

                                # Client payload with pre-shared secret
                                client_payload: dict[str, Any] = {
                                    "clientId": target_client_id,
                                    "name": "Glow App",
                                    "rootUrl": base_url,
                                    "baseUrl": base_url,
                                    "redirectUris": redirect_uris,
                                    "webOrigins": ["+"],
                                    "enabled": True,
                                    "publicClient": False,
                                    "protocol": "openid-connect",
                                    "standardFlowEnabled": True,
                                    "directAccessGrantsEnabled": True,
                                    "serviceAccountsEnabled": True,
                                    "clientAuthenticatorType": "client-secret",
                                    "secret": target_secret,
                                }

                                if existing_client:
                                    client_uuid = existing_client.get("id")
                                    if client_uuid:
                                        kc_admin.update_client(
                                            client_id=client_uuid,
                                            payload=client_payload,
                                        )
                                        logger.info(
                                            f"✅ Client '{target_client_id}' updated"
                                        )
                                    else:
                                        logger.warning(
                                            f"⚠️  Client '{target_client_id}' exists but has no ID"
                                        )
                                else:
                                    new_client_uuid = kc_admin.create_client(
                                        payload=client_payload, skip_exists=True
                                    )
                                    logger.info(
                                        f"✅ Client '{target_client_id}' created"
                                    )

                                    if new_client_uuid:
                                        kc_admin.update_client(
                                            client_id=new_client_uuid,
                                            payload={"secret": target_secret},
                                        )
                                        logger.info(
                                            f"✅ Client Secret enforced for '{target_client_id}'"
                                        )

                            except Exception as e:
                                logger.error(
                                    f"❌ Client sync failed: {e}", exc_info=True
                                )

                        # Sync all active identity providers from database
                        async with pool.acquire() as conn:
                            from app.utils.auth.decrypt_api_key import decrypt_api_key

                            providers_query = """
                                SELECT id, slug, auth_type as provider_id, name 
                                FROM auth 
                                WHERE active = true
                            """
                            providers = await conn.fetch(providers_query)

                            if not providers:
                                logger.info(
                                    "No active providers found in database, skipping sync"
                                )
                            else:
                                # Loop through each active provider
                                for p in providers:
                                    auth_id = p["id"]
                                    slug = p["slug"]
                                    provider_id = p["provider_id"]
                                    display_name = p["name"]

                                    items_query = """
                                        WITH default_settings AS (
                                            SELECT s.id as settings_id
                                            FROM settings s
                                            WHERE s.active = true
                                              AND NOT EXISTS (
                                                  SELECT 1 FROM department_settings sd 
                                                  WHERE sd.settings_id = s.id AND sd.active = true
                                              )
                                            LIMIT 1
                                        ),
                                        encrypted_items AS (
                                            SELECT ai.name, k.key as value, ai.encrypted
                                            FROM auth_items ai
                                            JOIN setting_auth_keys sak ON sak.auth_item_id = ai.id AND sak.active = true
                                            JOIN default_settings ds ON sak.settings_id = ds.settings_id
                                            JOIN keys k ON k.id = sak.key_id AND k.active = true
                                            WHERE ai.auth_id = $1 AND ai.encrypted = true
                                        ),
                                        non_encrypted_items AS (
                                            SELECT ai.name, sav.value, ai.encrypted
                                            FROM auth_items ai
                                            JOIN setting_auth_values sav ON sav.auth_item_id = ai.id
                                            JOIN default_settings ds ON sav.settings_id = ds.settings_id
                                            WHERE ai.auth_id = $1 AND ai.encrypted = false
                                        )
                                        SELECT name, value, encrypted 
                                        FROM encrypted_items
                                        UNION ALL
                                        SELECT name, value, encrypted 
                                        FROM non_encrypted_items
                                    """
                                    items = await conn.fetch(items_query, auth_id)

                                    # Decrypt or use plain text based on encrypted flag
                                    config_map: dict[str, str] = {}
                                    for item in items:
                                        item_name = item["name"]
                                        raw_value = item["value"]
                                        is_encrypted = item.get("encrypted", True)

                                        if is_encrypted:
                                            try:
                                                decrypted_value = decrypt_api_key(
                                                    raw_value
                                                )
                                                config_map[item_name] = decrypted_value
                                            except Exception as e:
                                                logger.warning(
                                                    f"Failed to decrypt auth_item '{item_name}' for provider '{slug}': {e}. "
                                                    f"Using as plain text."
                                                )
                                                config_map[item_name] = raw_value
                                        else:
                                            config_map[item_name] = raw_value

                                    # Construct Payload
                                    payload: dict[str, Any] = {
                                        "alias": slug,
                                        "providerId": provider_id,
                                        "displayName": display_name,
                                        "enabled": True,
                                        "trustEmail": True,
                                        "config": {},
                                    }

                                    # SAML Provider Configuration
                                    if provider_id == "saml":
                                        if "ssoUrl" in config_map:
                                            payload["config"][
                                                "singleSignOnServiceUrl"
                                            ] = config_map["ssoUrl"]
                                        if "entityId" in config_map:
                                            payload["config"]["entityId"] = config_map[
                                                "entityId"
                                            ]
                                        if "metadataUrl" in config_map:
                                            payload["config"]["importFromIdpUrl"] = (
                                                config_map["metadataUrl"]
                                            )
                                        if "certificate" in config_map:
                                            payload["config"]["signingCertificate"] = (
                                                config_map["certificate"]
                                            )
                                        if (
                                            "nameIDPolicyFormat"
                                            not in payload["config"]
                                        ):
                                            payload["config"]["nameIDPolicyFormat"] = (
                                                "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
                                            )
                                        if "syncMode" not in payload["config"]:
                                            payload["config"]["syncMode"] = "FORCE"
                                        if "allowCreate" not in payload["config"]:
                                            payload["config"]["allowCreate"] = "true"
                                    else:
                                        # OIDC/Google Provider Configuration
                                        payload["config"] = config_map
                                        if "syncMode" not in payload["config"]:
                                            payload["config"]["syncMode"] = "FORCE"
                                        if "useJwksUrl" not in payload["config"]:
                                            payload["config"]["useJwksUrl"] = "true"

                                    logger.info(
                                        f"🔍 Payload for {slug}: {payload['config']}"
                                    )

                                    # Upsert the provider in Keycloak
                                    try:
                                        kc_admin.get_idp(idp_alias=slug)
                                        kc_admin.update_idp(
                                            idp_alias=slug, payload=payload
                                        )
                                        logger.info(
                                            f"✅ Synced Keycloak provider: {slug}"
                                        )
                                    except Exception:
                                        kc_admin.create_idp(payload=payload)
                                        logger.info(
                                            f"✅ Created Keycloak provider: {slug}"
                                        )

                logger.info("Keycloak sync completed")
            except Exception as e:
                logger.warning(f"Keycloak sync failed (non-blocking): {e}")

        # Initialize metrics collector
        from app.utils.metrics.collector import (  # noqa: E402
            initialize_metrics,
            snapshot_metrics,
        )

        if pool:
            await initialize_metrics(pool, redis_client)
            logger.info("Metrics collector initialized")

            # Start periodic metrics snapshot task (every 60 seconds)
            async def metrics_task() -> None:
                """Periodic task to snapshot metrics."""
                while True:
                    try:
                        await asyncio.sleep(60)  # Wait 60 seconds
                        await snapshot_metrics()
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.error(f"Error in metrics task: {e}")

            metrics_task_handle = asyncio.create_task(metrics_task())

            # Register cleanup callback
            async def cleanup_metrics_task() -> None:
                metrics_task_handle.cancel()
                try:
                    await metrics_task_handle
                except asyncio.CancelledError:
                    pass

            stack.push_async_callback(cleanup_metrics_task)
            logger.info("Metrics snapshot task started (60s interval)")

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

        # Generate WebSocket contract and write to disk
        from app.utils.socket_contract import build_socket_contract

        client_to_server_handlers = [
            connect,
            disconnect,
            # Note: log_run is internal-only (async background work)
            # Simulation events
            simulation_join,
            simulation_leave,
            simulation_text_send,
            simulation_text_start,
            simulation_text_practice,
            simulation_text_stop,
            simulation_text_next,
            simulation_text_end,
            # Voice events
            simulation_voice_start,
            simulation_voice_stop,
            simulation_voice_debug_info,
            simulation_voice_user_text,
            simulation_voice_user_delta,
            simulation_voice_user_transcript,
            simulation_voice_user_start,
            simulation_voice_user_speech,
            simulation_voice_assistant_interrupted,
            simulation_voice_assistant_delta,
            simulation_voice_assistant_done,
            # AI generation events
            generate_scenario,
            document_generate,
            # Note: quiz events removed - questions now handled through scenarios
            # Note: generate_image, image_generation_complete, and scenario_tool_* events
            # are internal-only (triggered by scenario generation, not called directly by clients)
        ]

        # Import server-to-client emit functions (with Pydantic payload models)
        from app.socket.connect import connection_confirmed
        from app.socket.documents.generate import (
            document_template_generation_complete,
            document_template_generation_error,
            document_template_generation_progress,
        )
        from app.socket.scenarios.generate import (
            scenario_generation_complete,
            scenario_generation_error,
            scenario_generation_progress,
        )
        from app.socket.scenarios.tools.document import document_tool_complete
        from app.socket.scenarios.tools.image import image_tool_complete
        from app.socket.scenarios.tools.objectives import objectives_tool_complete
        from app.socket.scenarios.tools.questions import (
            scenario_questions_tool_complete,
            scenario_questions_tool_error,
        )
        from app.socket.scenarios.tools.statement import problem_statement_tool_complete
        from app.socket.scenarios.tools.video import (
            scenario_video_tool_complete,
            scenario_video_tool_error,
        )
        from app.socket.simulations.join import simulation_joined
        from app.socket.simulations.text.end import simulation_text_ended
        from app.socket.simulations.text.next import (
            end_all_completed,
            end_all_started,
            end_chat_started,
            simulation_continued,
            simulation_grading_progress,
            simulation_text_next_error,
        )
        from app.socket.simulations.text.practice import simulation_text_practice_error
        from app.socket.simulations.text.send import (
            hint_generation_progress,
            message_sent,
            simulation_message_complete,
            simulation_message_error,
            simulation_message_token,
            simulation_new_message,
            simulation_text_send_error,
        )
        from app.socket.simulations.text.start import simulation_started
        from app.socket.simulations.text.start import (
            simulation_text_start_error as simulation_error_start,
        )
        from app.socket.simulations.text.stop import (
            simulation_message_cancelled,
            simulation_stopped,
            simulation_text_stop_error,
        )
        from app.socket.simulations.voice.assistant.delta import voice_tool_call_error
        from app.socket.simulations.voice.start import (
            simulation_voice_start_error,
            simulation_voice_start_response,
        )
        from app.socket.simulations.voice.stop import (
            simulation_voice_stop_error,
            simulation_voice_stop_response,
        )
        from app.socket.simulations.voice.user.delta import (
            simulation_voice_user_delta_emit,
        )
        from app.socket.simulations.voice.user.start import (
            simulation_voice_user_start_emit,
        )
        from app.socket.simulations.voice.user.text import (
            simulation_voice_user_text_error,
        )
        from app.socket.simulations.voice.user.transcript import (
            simulation_voice_user_transcript_emit,
        )

        # Collect all unique emit functions (use one instance of each event name)
        server_to_client_stubs = [
            # Simulation text events
            simulation_error_start,  # simulation_text_start_error
            simulation_text_stop_error,
            simulation_text_send_error,
            simulation_text_next_error,
            simulation_text_practice_error,
            simulation_started,
            simulation_message_cancelled,
            simulation_stopped,
            simulation_new_message,
            simulation_message_token,
            simulation_message_complete,
            simulation_message_error,
            message_sent,
            hint_generation_progress,
            simulation_grading_progress,
            simulation_continued,
            end_all_started,
            end_chat_started,
            end_all_completed,
            # Connection events
            connection_confirmed,
            simulation_joined,
            simulation_text_ended,
            # AI generation events
            scenario_generation_progress,
            scenario_generation_complete,
            scenario_generation_error,
            document_template_generation_progress,
            document_template_generation_complete,
            document_template_generation_error,
            # Scenario tool completion events
            document_tool_complete,  # scenario_tool_document_complete
            problem_statement_tool_complete,  # scenario_tool_problem_statement_complete
            objectives_tool_complete,  # scenario_tool_objectives_complete
            image_tool_complete,  # scenario_tool_image_complete
            # Scenario video/questions tool events
            scenario_video_tool_complete,  # scenario_tool_video_complete
            scenario_video_tool_error,  # scenario_tool_video_error
            scenario_questions_tool_complete,  # scenario_tool_questions_complete
            scenario_questions_tool_error,  # scenario_tool_questions_error
            # Voice events
            simulation_voice_start_response,
            simulation_voice_start_error,
            simulation_voice_stop_response,
            simulation_voice_stop_error,
            simulation_voice_user_start_emit,
            simulation_voice_user_delta_emit,
            simulation_voice_user_transcript_emit,
            simulation_voice_user_text_error,
            voice_tool_call_error,
            # Note: quiz events removed - questions now handled through scenarios
        ]

        contract = build_socket_contract(
            client_to_server=client_to_server_handlers,
            server_to_client=server_to_client_stubs,  # type: ignore[arg-type]
        )

        ws_path = Path(__file__).parent.parent / "ws.json"
        ws_path.write_text(json.dumps(contract, indent=2))
        logger.info(f"✅ WebSocket contract written to {ws_path}")

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
        from app.utils.logging.db_logger import (
            get_logger,
            resolve_profile_id,
            set_profile_id,
        )
        from app.utils.metrics.collector import record_error, record_request

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

        # Try to get from headers
        if not profile_id:
            profile_id = request.headers.get("X-Profile-Id")

        # Resolve guest profile if needed
        if profile_id:
            try:
                resolved_id = await resolve_profile_id(profile_id)
                set_profile_id(resolved_id)
            except Exception as e:
                logger.warning(f"Error resolving profile_id: {e}")
                set_profile_id(None)
        else:
            # If no profile_id found, try to resolve from department cookies
            from app.utils.logging.db_logger import (
                resolve_profile_from_department_cookies,
            )

            department_id_cookie = request.cookies.get("department-id")
            auth_mode_cookie = request.cookies.get("auth-mode")

            if department_id_cookie and auth_mode_cookie:
                try:
                    resolved_id = await resolve_profile_from_department_cookies(
                        department_id_cookie, auth_mode_cookie
                    )
                    if resolved_id:
                        set_profile_id(resolved_id)
                    else:
                        # Fallback to default guest profile
                        resolved_id = await resolve_profile_id("guest-profile-id")
                        set_profile_id(resolved_id)
                except Exception as e:
                    logger.warning(
                        f"Error resolving profile from department cookies: {e}"
                    )
                    # Fallback to default guest profile
                    try:
                        resolved_id = await resolve_profile_id("guest-profile-id")
                        set_profile_id(resolved_id)
                    except Exception:
                        set_profile_id(None)
            else:
                # No cookies, resolve to default guest profile
                try:
                    resolved_id = await resolve_profile_id("guest-profile-id")
                    set_profile_id(resolved_id)
                except Exception:
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

            # Log to database (fire and forget - don't block response)
            try:
                extra_data: dict[str, Any] = {
                    "method": request.method,
                    "path": str(request.url.path),
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client": request.client.host if request.client else None,
                }
                if error_msg:
                    extra_data["error"] = error_msg

                # Use logger with extra data
                import logging

                log_level = logging.INFO if status_code < 500 else logging.ERROR
                log_message = f"{request.method} {request.url.path} -> {status_code} ({duration_ms:.2f}ms)"

                # Log directly with extra data
                logger.log(log_level, log_message, extra={"extra_data": extra_data})
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
    """
    from app.utils.health import run_service_checks

    checks = await run_service_checks()

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
