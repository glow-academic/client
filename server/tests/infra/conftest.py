"""Shared fixtures for infra integration tests.

Uses black-box tool functions to set up real test data.
All data lives in the disposable testcontainers DB.
"""

from uuid import UUID

import pytest
import pytest_asyncio

from .factories import create_profile_identity_fixture

# Seeded profile IDs (from test-seed.sql)
SUPERADMIN_PROFILE_ID = UUID("019b3be4-36f0-788c-9df2-481eb5917940")
ADMIN_PROFILE_ID = UUID("019b3be4-36ef-7a5f-98ab-ccb879770be0")
INSTRUCTIONAL_PROFILE_ID = UUID("019b3be4-36f0-785d-9d61-32eae65689ca")
MEMBER_PROFILE_ID = UUID("019b3be4-36f0-7eb3-bc4e-bcab772edd92")
GUEST_PROFILE_ID = UUID("019b3be4-36f0-792c-82d6-126664ed18b6")

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
