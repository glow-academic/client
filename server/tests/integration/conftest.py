"""Pytest configuration for API route tests."""

from collections.abc import AsyncGenerator

import asyncpg  # type: ignore
import httpx
import pytest
import pytest_asyncio
from app.main import get_db
from app.main import fastapi_app


@pytest_asyncio.fixture
async def client(
    db: asyncpg.Connection,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide FastAPI TestClient with database dependency override.

    Overrides get_db to return the test database connection from the db fixture.
    This allows route tests to use the same database setup as service tests.
    """

    # Override get_db dependency to use test connection
    async def override_get_db() -> AsyncGenerator[asyncpg.Connection, None]:
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    # Create async client using ASGI transport
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as test_client:
        yield test_client

    # Clean up dependency override
    fastapi_app.dependency_overrides.clear()
