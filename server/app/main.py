# server/app/main.py
import asyncio
import base64
import contextlib
import json
import logging
import os
import platform
import sys
import time
import uuid
from collections.abc import AsyncGenerator, AsyncIterator
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

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT
UPLOAD_FOLDER = BASE_FOLDER / "uploads"
UPLOAD_FOLDER.mkdir(
    parents=True, exist_ok=True
)  # saving each document as uploads/document_id.ext

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


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance."""
    return sio


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
            f"   ⚙️  PgBouncer detected (transaction mode): Disabling prepared statements for compatibility"
        )
    elif using_pgbouncer and pgbouncer_pool_mode == "session":
        # Session mode allows prepared statements - use default cache size
        print(
            f"   ⚙️  PgBouncer detected (session mode): Using prepared statements for better performance"
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
                        SELECT id::text
                        FROM profiles
                        WHERE role = 'guest' AND default_profile = true
                        ORDER BY created_at DESC
                        LIMIT 1
                        """
                    )
                    
                    if result:
                        _guest_profile_id = str(result)
                        logger.info(f"✅ Cached guest profile UUID: {_guest_profile_id}")
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

            # Sync Keycloak identity providers from database
            try:
                # Keycloak sync configuration
                keycloak_url = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
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
                        logger.warning("keycloak package not installed, skipping Keycloak sync")
                        return None

                    retry_delay = INITIAL_RETRY_DELAY
                    
                    for attempt in range(1, max_retries + 1):
                        try:
                            logger.info(
                                f"Attempting to connect to Keycloak (attempt {attempt}/{max_retries})..."
                            )
                            kc_admin = KeycloakAdmin(
                                server_url=f"{url}/",
                                username=admin,
                                password=password,
                                realm_name="master",
                                verify=True,
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
                        logger.error(f"Failed to ensure realm exists: {e}", exc_info=True)
                        kc_admin = None

                    if kc_admin:
                        # Switch to target realm
                        kc_admin.change_current_realm(realm_name=keycloak_realm)

                        # Fix realm frontend URL to prevent double /realms/glow in issuer
                        try:
                            realm_details = kc_admin.get_realm(keycloak_realm)
                            attributes = realm_details.get("attributes", {})
                            current_frontend_url = attributes.get("frontendUrl", "")
                            
                            if current_frontend_url and "/realms/" in current_frontend_url:
                                logger.info(f"Fixing realm frontend URL (was: {current_frontend_url})")
                                kc_admin.update_realm(
                                    realm_name=keycloak_realm,
                                    payload={
                                        "attributes": {
                                            **attributes,
                                            "frontendUrl": "",
                                        }
                                    },
                                )
                                logger.info("✅ Realm frontend URL fixed (set to empty)")
                            elif not current_frontend_url:
                                logger.info("✅ Realm frontend URL is already correct (empty)")
                        except Exception as e:
                            logger.warning(f"Could not update realm frontend URL: {e}. Continuing...")

                        # Setup Next.js client with pre-shared secret
                        target_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")
                        target_secret: str | None = os.getenv("AUTH_KEYCLOAK_SECRET")
                        client_port = os.getenv("CLIENT_PORT", "3000")
                        app_prefix = os.getenv("APP_PREFIX", "")

                        if not target_secret:
                            logger.warning(
                                "⚠️  AUTH_KEYCLOAK_SECRET is missing. Cannot enforce DHH-style auth."
                            )
                        else:
                            try:
                                # Build redirect URIs
                                base_url = f"http://localhost:{client_port}"
                                redirect_uri = f"{base_url}{app_prefix}/api/auth/callback/keycloak"
                                redirect_uris = [
                                    redirect_uri,
                                    f"{base_url}{app_prefix}/*",
                                ]

                                # Check if client exists
                                clients = kc_admin.get_clients()
                                existing_client = next(
                                    (c for c in clients if c.get("clientId") == target_client_id), None
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
                                            client_id=client_uuid, payload=client_payload
                                        )
                                        logger.info(f"✅ Client '{target_client_id}' updated")
                                    else:
                                        logger.warning(
                                            f"⚠️  Client '{target_client_id}' exists but has no ID"
                                        )
                                else:
                                    new_client_uuid = kc_admin.create_client(
                                        payload=client_payload, skip_exists=True
                                    )
                                    logger.info(f"✅ Client '{target_client_id}' created")

                                    if new_client_uuid:
                                        kc_admin.update_client(
                                            client_id=new_client_uuid, payload={"secret": target_secret}
                                        )
                                        logger.info(
                                            f"✅ Client Secret enforced for '{target_client_id}'"
                                        )

                            except Exception as e:
                                logger.error(f"❌ Client sync failed: {e}", exc_info=True)

                        # Sync all active identity providers from database
                        async with pool.acquire() as conn:
                            from app.utils.auth.decrypt_api_key import \
                                decrypt_api_key

                            providers_query = """
                                SELECT id, slug, provider_id, name 
                                FROM auth 
                                WHERE active = true
                            """
                            providers = await conn.fetch(providers_query)

                            if not providers:
                                logger.info("No active providers found in database, skipping sync")
                            else:
                                # Loop through each active provider
                                for p in providers:
                                    auth_id = p["id"]
                                    slug = p["slug"]
                                    provider_id = p["provider_id"]
                                    display_name = p["name"]

                                    items_query = """
                                        SELECT name, value, encrypted 
                                        FROM auth_items 
                                        WHERE auth_id = $1
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
                                                decrypted_value = decrypt_api_key(raw_value)
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
                                        "config": {}
                                    }

                                    # SAML Provider Configuration
                                    if provider_id == "saml":
                                        if "ssoUrl" in config_map:
                                            payload["config"]["singleSignOnServiceUrl"] = config_map["ssoUrl"]
                                        if "entityId" in config_map:
                                            payload["config"]["entityId"] = config_map["entityId"]
                                        if "metadataUrl" in config_map:
                                            payload["config"]["importFromIdpUrl"] = config_map["metadataUrl"]
                                        if "certificate" in config_map:
                                            payload["config"]["signingCertificate"] = config_map["certificate"]
                                        if "nameIDPolicyFormat" not in payload["config"]:
                                            payload["config"]["nameIDPolicyFormat"] = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
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

                                    logger.info(f"🔍 Payload for {slug}: {payload['config']}")

                                    # Upsert the provider in Keycloak
                                    try:
                                        kc_admin.get_idp(idp_alias=slug)
                                        kc_admin.update_idp(idp_alias=slug, payload=payload)
                                        logger.info(f"✅ Synced Keycloak provider: {slug}")
                                    except Exception:
                                        kc_admin.create_idp(payload=payload)
                                        logger.info(f"✅ Created Keycloak provider: {slug}")

                logger.info("Keycloak sync completed")
            except Exception as e:
                logger.warning(f"Keycloak sync failed (non-blocking): {e}")

        # Initialize metrics collector
        from app.utils.metrics.collector import (  # noqa: E402
            initialize_metrics, snapshot_metrics)

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

# Database logging middleware (after CORS)
# Inlined from middleware/db_logging.py to follow DHH principles - minimal abstractions
class DBLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that automatically logs all requests/responses to database."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process request and log to database."""
        from app.utils.logging.db_logger import (get_logger,
                                                 resolve_profile_id,
                                                 set_profile_id)
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
            # If no profile_id found, resolve to guest profile
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


# ============================================================================
# TUS Protocol Upload Endpoints
# ============================================================================
# Generic file upload endpoints using TUS protocol (resumable uploads)
# These endpoints are database-agnostic and operate purely on the filesystem


@fastapi_app.options("/upload")
async def tus_options(request: Request) -> Response:
    """Handle OPTIONS request for tus protocol discovery."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Tus-Max-Size": "1073741824",  # 1GB max file size
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@fastapi_app.post("/upload")
async def tus_creation(request: Request) -> Response:
    """Handle POST request for tus protocol - create upload."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Get upload length
    upload_length = request.headers.get("Upload-Length")
    if not upload_length:
        return Response(status_code=400, content="Missing Upload-Length header")

    # Parse metadata
    metadata = {}
    if "Upload-Metadata" in request.headers:
        for kv in request.headers["Upload-Metadata"].split(","):
            if " " in kv:
                k, v = kv.strip().split(" ", 1)
                metadata[k] = base64.b64decode(v).decode("utf-8")

    # Get app prefix from environment
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")

    # Create upload directory and files
    upload_id = str(uuid.uuid4())
    upload_dir = TUS_UPLOADS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save metadata
    with open(upload_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)

    # Create empty file
    with open(upload_dir / "file", "wb") as f:
        pass

    # Save upload info
    with open(upload_dir / "info", "w") as f:
        f.write(f"length:{upload_length}\noffset:0")

    # Generate location path
    if app_prefix:
        location = f"/{app_prefix}/upload/{upload_id}"
    else:
        location = f"/upload/{upload_id}"

    # Handle creation-with-upload if Content-Length > 0
    if request.headers.get("Content-Length", "0") != "0":
        chunk = await request.body()

        # Read current info
        info = {}
        with open(upload_dir / "info") as f:
            for line in f:
                k, v = line.strip().split(":", 1)
                info[k] = v

        # Append chunk to file
        with open(upload_dir / "file", "ab") as f:
            f.write(chunk)

        # Update offset
        new_offset = int(info.get("offset", "0")) + len(chunk)
        with open(upload_dir / "info", "w") as f:
            f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(new_offset),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            },
        )

    return Response(
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        },
    )


@fastapi_app.head("/upload/{upload_id}")
async def tus_head(upload_id: str, request: Request) -> Response:
    """Handle HEAD request for tus protocol - get upload info."""
    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    # Read info file
    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": info.get("offset", "0"),
        "Upload-Length": info.get("length", "0"),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
    }

    return Response(headers=headers)


@fastapi_app.patch("/upload/{upload_id}")
async def tus_patch(upload_id: str, request: Request) -> Response:
    """Handle PATCH request for tus protocol - upload chunk."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Check content type
    if request.headers.get("Content-Type") != "application/offset+octet-stream":
        return Response(status_code=415)

    # Get expected offset
    expected_offset = request.headers.get("Upload-Offset")
    if not expected_offset:
        return Response(status_code=400, content="Missing Upload-Offset header")

    # Read chunk
    chunk = await request.body()

    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    # Read info file
    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    # Check offset
    if expected_offset != info.get("offset"):
        return Response(status_code=409)

    # Append to file
    with open(upload_dir / "file", "ab") as f:
        f.write(chunk)

    # Update offset
    new_offset = int(info.get("offset", "0")) + len(chunk)
    with open(upload_dir / "info", "w") as f:
        f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )


@fastapi_app.options("/upload/{upload_id}")
async def tus_options_upload_id(upload_id: str, request: Request) -> Response:
    """Handle OPTIONS request for specific upload."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
