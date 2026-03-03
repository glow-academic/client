"""Application factory — owns FastAPI app, lifespan, middleware, and route mounting.

This module builds the complete ASGI application.  ``main.py`` simply re-exports
the ``app`` object created here so that ``uvicorn app.main:app`` keeps working.
"""
# mypy: ignore-errors

import asyncio
import contextlib
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import socketio  # type: ignore
from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from starlette.middleware.base import BaseHTTPMiddleware

from app.globals import (
    close_db_pool,
    get_pool,
    init_db_pool,
    sio,
    socket_path,
)

logger = logging.getLogger(__name__)

# Guarded Redis import to prevent crashes when redis is not installed
try:
    import redis.asyncio as redis  # type: ignore
except ImportError:
    redis = None  # type: ignore


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        # Configure uvicorn loggers to use compact format
        compact_formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
        )
        for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
            uvicorn_logger = logging.getLogger(logger_name)
            uvicorn_logger.propagate = False
            if uvicorn_logger.handlers:
                for handler in uvicorn_logger.handlers:
                    handler.setFormatter(compact_formatter)
            else:
                handler = logging.StreamHandler()
                handler.setFormatter(compact_formatter)
                uvicorn_logger.addHandler(handler)

        # Configure Socket.IO loggers
        for logger_name in [
            "socketio",
            "engineio",
            "socketio.server",
            "engineio.server",
        ]:
            socketio_logger = logging.getLogger(logger_name)
            socketio_logger.propagate = False
            if socketio_logger.handlers:
                for handler in socketio_logger.handlers:
                    handler.setFormatter(compact_formatter)
            else:
                handler = logging.StreamHandler()
                handler.setFormatter(compact_formatter)
                socketio_logger.addHandler(handler)

        # Initialize Redis client for HTTP caching and socket ownership management
        import app.globals as _globals

        redis_url = os.getenv("REDIS_URL")
        logger.info(
            f"Initializing HTTP cache Redis client: redis={redis is not None}, redis_url={redis_url}"
        )
        if not redis or not redis_url:
            logger.warning(
                "Redis disabled (no lib or no REDIS_URL); using in-memory fallbacks"
            )
            _globals.redis_client = None
        else:
            try:
                client = redis.from_url(redis_url)  # type: ignore
                await client.ping()
                _globals.redis_client = client
                logger.info(f"Redis client initialized for HTTP caching: {redis_url}")
            except Exception as e:
                logger.error(f"Failed to initialize Redis client: {e}", exc_info=True)
                _globals.redis_client = None

        # Initialize asyncpg database pool
        await init_db_pool()

        pool = get_pool()

        # Initialize metrics collector
        from app.metrics.collector import initialize_metrics

        if pool:
            await initialize_metrics(pool, _globals.redis_client)
            logger.info("Metrics collector initialized")
            logger.info(
                "Metrics snapshot and health logging now handled by notify service"
            )

        # Import MCP server for lifespan management
        from app.mcp import mcp_server as artifacts_resources_mcp_server

        await stack.enter_async_context(
            artifacts_resources_mcp_server.session_manager.run()
        )

        # Generate OpenAPI schema and write to disk
        schema = get_openapi(
            title=app.title,
            version="0.1.0",
            routes=app.routes,
            description="Auto-generated OpenAPI schema from FastAPI v5 API",
        )

        for _path, path_item in schema.get("paths", {}).items():
            for _method, operation in path_item.items():
                if isinstance(operation, dict) and "tags" in operation:
                    tags = operation.get("tags", [])
                    if tags:
                        operation["x-cache-tags"] = tags

        openapi_path = Path(__file__).resolve().parents[1] / "openapi.json"
        openapi_path.write_text(json.dumps(schema, indent=2))
        logger.info(f"OpenAPI schema written to {openapi_path}")

        # Start voice session reaper (cleans up idle sessions every 60s)
        async def _reap_stale_voice_sessions() -> None:
            from app.infra.websocket.audio_lifecycle import cleanup_audio_session
            from app.infra.websocket.session_store import get_stale_sessions

            while True:
                try:
                    await asyncio.sleep(60)
                    stale = get_stale_sessions(timeout=300.0)
                    for session in stale:
                        logger.info(
                            f"Reaping stale voice session - group_id={session.group_id}"
                        )
                        await cleanup_audio_session(session)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Voice session reaper error: {e}")

        reaper_task = asyncio.create_task(_reap_stale_voice_sessions())

        yield

        # Stop reaper
        reaper_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reaper_task

        await close_db_pool()

        if _globals.redis_client:
            await _globals.redis_client.close()
            _globals.redis_client = None
            logger.info("Redis client closed")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
fastapi_app = FastAPI(title="GLOW API", lifespan=lifespan, redirect_slashes=False)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# DB Logging middleware
# ---------------------------------------------------------------------------
class DBLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that automatically logs all requests/responses to database."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        from app.metrics.collector import record_error, record_request
        from app.utils.logging.db_logger import get_logger, set_profile_id

        logger = get_logger(__name__)
        start_time = time.perf_counter()

        profile_id: str | None = None

        content_type = request.headers.get("Content-Type", "")
        is_binary_content = (
            content_type == "application/offset+octet-stream"
            or content_type.startswith("multipart/")
            or content_type.startswith("image/")
            or content_type.startswith("video/")
            or content_type.startswith("audio/")
        )

        if request.method in ("POST", "PUT", "PATCH") and not is_binary_content:
            try:
                body = await request.body()
                if body:
                    body_json = json.loads(body)
                    profile_id = (
                        body_json.get("profileId")
                        or body_json.get("profile_id")
                        or body_json.get("actualProfileId")
                        or body_json.get("effectiveProfileId")
                    )
            except (json.JSONDecodeError, UnicodeDecodeError, KeyError, AttributeError):
                pass

        if hasattr(request.state, "profile_id") and request.state.profile_id:
            profile_id = request.state.profile_id
        else:
            if not profile_id:
                profile_id = request.headers.get("X-Profile-Id")

        if profile_id:
            set_profile_id(profile_id)
        else:
            set_profile_id(None)

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
            duration_ms = (time.perf_counter() - start_time) * 1000
            try:
                if status_code >= 500:
                    asyncio.create_task(record_error())
                asyncio.create_task(record_request(duration_ms))
            except Exception:
                pass
            finally:
                set_profile_id(None)


fastapi_app.add_middleware(DBLoggingMiddleware)

# Add MCP OAuth middleware
from app.mcp.oauth import McpOAuthMiddleware  # noqa: E402

fastapi_app.add_middleware(McpOAuthMiddleware)

# ---------------------------------------------------------------------------
# Routers — versioned API
# ---------------------------------------------------------------------------
from app.v5.router import router as api_v5_router  # noqa: E402

fastapi_app.include_router(api_v5_router)

from app.v5.socket import router as socket_v5_router  # noqa: E402

fastapi_app.include_router(socket_v5_router)

# ---------------------------------------------------------------------------
# Routers — root-level (version-agnostic)
# ---------------------------------------------------------------------------
from app.auth import router as auth_router  # noqa: E402
from app.utils.mcp.get_mcp import get_mcp  # noqa: E402
from app.utils.profile.get_profile_id import get_profile_id  # noqa: E402
from app.utils.session.get_session_id import get_session_id  # noqa: E402

fastapi_app.include_router(
    auth_router,
    dependencies=[
        Depends(get_profile_id),
        Depends(get_session_id),
        Depends(get_mcp),
    ],
)

from app.default_idp import router as default_idp_router  # noqa: E402

fastapi_app.include_router(default_idp_router)

from app.uploads import router as uploads_router  # noqa: E402

fastapi_app.include_router(uploads_router)

from app.health import router as health_router  # noqa: E402

fastapi_app.include_router(health_router)

from app.metrics import router as metrics_router  # noqa: E402

fastapi_app.include_router(metrics_router)

from app.well_known import router as well_known_router  # noqa: E402

fastapi_app.include_router(well_known_router)

from app.root_info import router as root_info_router  # noqa: E402

fastapi_app.include_router(root_info_router)

from app.schema_changed import router as schema_changed_router  # noqa: E402

fastapi_app.include_router(schema_changed_router)

from app.init import router as init_router  # noqa: E402

fastapi_app.include_router(init_router)


# ---------------------------------------------------------------------------
# MCP mount
# ---------------------------------------------------------------------------
from app.mcp import mcp_server as artifacts_resources_mcp_server  # noqa: E402

mcp_app = artifacts_resources_mcp_server.streamable_http_app()
fastapi_app.mount("/", mcp_app, name="Artifacts-Resources-MCP")


# ---------------------------------------------------------------------------
# Combined ASGI app (Socket.IO + FastAPI)
# ---------------------------------------------------------------------------
app = socketio.ASGIApp(sio, fastapi_app, socketio_path=socket_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)

eval_logger = logging.getLogger("app.agents.generic")
eval_logger.setLevel(logging.INFO)
