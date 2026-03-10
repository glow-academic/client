"""Shared fixtures for infra integration tests.

Uses black-box tool functions to set up real test data.
All data lives in the disposable testcontainers DB.
"""

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from uuid import UUID

import pytest
import pytest_asyncio
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient

from .factories import (
    create_persona_context_fixture,
    create_profile_identity_fixture,
    create_setting_graph_fixture,
    create_system_graph_fixture,
)

pytestmark = pytest.mark.asyncio


@dataclass
class V5RouteClient:
    """Tiny authenticated HTTP client for v5 route tests."""

    client: AsyncClient
    _request_state: dict[str, str | None]

    def authenticate(
        self,
        *,
        profile_id: UUID | str,
        session_id: UUID | str | None = None,
    ) -> None:
        self._request_state["profile_id"] = str(profile_id)
        self._request_state["session_id"] = (
            str(session_id) if session_id is not None else None
        )


@pytest_asyncio.fixture
async def name_id(pool, redis_client) -> UUID:
    """Create a fresh name resource via black-box tool."""
    from app.routes.v5.tools.resources.names.create import create_name

    async with pool.acquire() as conn:
        result = await create_name(conn, "Test Name", redis_client)
    return result.id


@pytest_asyncio.fixture
async def description_id(pool, redis_client) -> UUID:
    """Create a fresh description resource via black-box tool."""
    from app.routes.v5.tools.resources.descriptions.create import create_description

    async with pool.acquire() as conn:
        result = await create_description(conn, "Test description", redis_client)
    return result.id


@pytest_asyncio.fixture
async def profile_identity_factory(pool, redis_client):
    """Create real profile artifacts plus linked resources for context tests."""

    return lambda **kwargs: create_profile_identity_fixture(
        pool,
        redis_client,
        **kwargs,
    )


@pytest_asyncio.fixture
async def setting_graph_factory(pool, redis_client):
    """Create a real profile -> setting -> system -> agent -> tool graph."""

    return lambda **kwargs: create_setting_graph_fixture(
        pool,
        redis_client,
        **kwargs,
    )


@pytest_asyncio.fixture
async def system_graph_factory(pool, redis_client):
    """Create a real system -> agent -> model/provider/tool graph."""

    return lambda **kwargs: create_system_graph_fixture(
        pool,
        redis_client,
        **kwargs,
    )


@pytest_asyncio.fixture
async def persona_context_factory(pool, redis_client):
    """Create a real persona artifact plus draft and suggestion resources."""

    return lambda **kwargs: create_persona_context_fixture(
        pool,
        redis_client,
        **kwargs,
    )


@pytest_asyncio.fixture
async def v5_route_client(pool, redis_client) -> AsyncGenerator[V5RouteClient, None]:
    """HTTP client mounted on the real v5 artifact router with test auth state."""
    import app.infra.globals as globals_mod
    from app.infra.auth.middleware import require_auth
    from app.routes.v5.api.main.persona import router as persona_router
    from app.utils.mcp.get_mcp import get_mcp

    request_state: dict[str, str | None] = {"profile_id": None, "session_id": None}

    async def _require_auth_override(request: Request) -> None:
        profile_id = request_state["profile_id"]
        if not profile_id:
            raise HTTPException(status_code=401, detail="Missing test profile_id")
        request.state.profile_id = profile_id
        request.state.session_id = request_state["session_id"]

    async def _get_mcp_override(request: Request) -> bool:
        request.state.mcp = False
        return False

    app = FastAPI()
    root_router = APIRouter(
        prefix="/api/v5",
        dependencies=[Depends(require_auth), Depends(get_mcp)],
    )
    artifacts_router = APIRouter(prefix="/artifacts")
    artifacts_router.include_router(persona_router)
    root_router.include_router(artifacts_router)
    app.include_router(root_router)
    app.dependency_overrides[require_auth] = _require_auth_override
    app.dependency_overrides[get_mcp] = _get_mcp_override

    prior_pool = globals_mod._db_pool
    prior_redis = globals_mod.redis_client
    globals_mod._db_pool = pool
    globals_mod.redis_client = redis_client

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        yield V5RouteClient(client=client, _request_state=request_state)

    globals_mod._db_pool = prior_pool
    globals_mod.redis_client = prior_redis
