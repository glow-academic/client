# server/app/main.py
import contextlib
import json
import logging
import os
import platform
import sys
from collections.abc import AsyncGenerator, AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Any

import asyncpg  # type: ignore
import socketio  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from mcp.server.fastmcp import FastMCP

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

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT
UPLOAD_FOLDER = BASE_FOLDER / "uploads"
UPLOAD_FOLDER.mkdir(
    parents=True, exist_ok=True
)  # saving each document as uploads/document_id.ext

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

# Global storage for scenario generation results
scenario_results: dict[str, Any] = {}
scenario_progress: dict[str, bool] = {}

# Global storage for grading results
grading_results: dict[str, Any] = {}
grading_progress: dict[str, bool] = {}

# Global storage for hint results
hint_results: dict[str, Any] = {}
hint_progress: dict[str, bool] = {}

# Global storage for guardrail results
guardrail_results: dict[str, Any] = {}
guardrail_progress: dict[str, bool] = {}


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
    # PgBouncer in transaction mode requires disabling prepared statements
    using_pgbouncer = db_host == "pgbouncer"

    print(f"🔌 Initializing asyncpg connection pool to {db_host}:{db_port}/{db_name}")

    pool_config = {
        "min_size": 10,
        "max_size": 100,  # High capacity for concurrent analytics + background refresh
        "command_timeout": 60,  # Allow time for complex analytics queries (cold cache)
        "max_queries": 50000,  # Limit queries per connection before recycling
        "max_inactive_connection_lifetime": 300,  # 5 minutes
    }

    # Note: When using PgBouncer in production:
    # - Set PgBouncer pool_mode=transaction (recommended for FastAPI)
    # - Configure PgBouncer: default_pool_size=25, max_client_conn=200
    # - This gives you: 100 app connections -> PgBouncer -> 25 DB connections
    # - Reduces DB connection overhead while maintaining app concurrency

    # Disable prepared statements for PgBouncer transaction mode
    if using_pgbouncer:
        pool_config["statement_cache_size"] = 0
        print(
            "   ⚙️  PgBouncer detected: Disabling prepared statements for transaction mode compatibility"
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
from app.socket.assistants import send_assistant_message  # type: ignore
from app.socket.assistants import start_assistant  # type: ignore
from app.socket.assistants.stop import \
    stop_assistant  # noqa: E402; type: ignore
from app.socket.connections import leave_chat  # type: ignore
from app.socket.connections.connect import connect  # type: ignore
from app.socket.connections.disconnect import disconnect  # type: ignore
from app.socket.connections.join_chat import join_chat  # type: ignore
from app.socket.connections.stop_chat import \
    stop_chat  # noqa: E402; type: ignore
from app.socket.simulations import send_simulation_message  # type: ignore
from app.socket.simulations import start_simulation  # type: ignore
from app.socket.simulations.continue_chat import \
    continue_simulation  # noqa: E402; type: ignore
from app.socket.simulations.create_practice_scenario import \
    create_practice_scenario  # noqa: E402; type: ignore
from app.socket.simulations.stop import \
    stop_simulation  # noqa: E402; type: ignore


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

        # Initialize Redis client for HTTP caching and socket ownership management
        global redis_client
        redis_url = os.getenv("REDIS_URL")
        logger.info(f"Initializing HTTP cache Redis client: redis={redis is not None}, redis_url={redis_url}")
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
            send_assistant_message,
            start_assistant,
            stop_assistant,
            send_simulation_message,
            start_simulation,
            create_practice_scenario,  # type: ignore[name-defined]
            stop_simulation,
            continue_simulation,  # type: ignore[name-defined]
            join_chat,
            leave_chat,
            stop_chat,
        ]

        # Import server-to-client emit functions (with Pydantic payload models)
        from app.socket.assistants.send_message import (  # noqa: E402
            assistant_message_cancelled, assistant_message_complete,
            assistant_message_token, assistant_new_message, message_complete,
            tool_call_completed, tool_call_created)
        from app.socket.assistants.start import assistant_started
        from app.socket.assistants.start import \
            start_assistant_error as assistant_error_start
        from app.socket.assistants.start import title_updated
        from app.socket.assistants.stop import assistant_stopped
        from app.socket.connections.connect import connection_confirmed
        from app.socket.connections.join_chat import joined_chat
        from app.socket.connections.stop_chat import chat_stopped
        from app.socket.simulations.continue_chat import (
            continue_simulation_error, end_all_completed, end_all_started,
            end_chat_started, simulation_continued,
            simulation_grading_progress)
        from app.socket.simulations.create_practice_scenario import \
            create_practice_scenario_error
        from app.socket.simulations.send_message import (
            hint_generation_progress, message_sent,
            send_simulation_message_error, simulation_message_complete,
            simulation_message_error, simulation_message_token,
            simulation_new_message)
        from app.socket.simulations.start import simulation_started
        from app.socket.simulations.start import \
            start_simulation_error as simulation_error_start
        from app.socket.simulations.stop import (simulation_message_cancelled,
                                                 simulation_stopped,
                                                 stop_simulation_error)

        # Collect all unique emit functions (use one instance of each event name)
        server_to_client_stubs = [
            # Assistant events
            assistant_error_start,  # Use one instance (they're all the same)
            assistant_started,
            title_updated,
            assistant_new_message,
            message_complete,
            tool_call_created,
            tool_call_completed,
            assistant_message_token,
            assistant_message_complete,
            assistant_message_cancelled,
            assistant_stopped,
            # Simulation events
            simulation_error_start,  # start_simulation_error
            stop_simulation_error,
            send_simulation_message_error,
            continue_simulation_error,
            create_practice_scenario_error,
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
            joined_chat,
            chat_stopped,
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
