"""Shared fixtures for infra integration tests.

Uses black-box tool functions to set up real test data.
All data lives in the disposable testcontainers DB.
"""

from uuid import UUID

import pytest
import pytest_asyncio

from .factories import (
    create_persona_context_fixture,
    create_profile_identity_fixture,
    create_setting_graph_fixture,
    create_system_graph_fixture,
)

pytestmark = pytest.mark.asyncio


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
