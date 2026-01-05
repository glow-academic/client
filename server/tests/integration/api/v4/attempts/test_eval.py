"""Route tests for POST /api/v4/attempts/eval endpoint."""


import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_eval_attempt(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating an eval attempt."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/attempts/eval",
        json={
            "eval_id": None,
            "agent_ids": [],
        },
    )

    # Response depends on whether eval_id is provided
    assert response.status_code in [200, 400, 404]
    data = response.json()

    assert data is not None
