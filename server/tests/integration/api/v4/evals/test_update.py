"""Route tests for POST /api/v4/evals/update endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_eval_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent eval."""
    await get_superadmin_alias(db)

    fake_eval_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/evals/update",
        json={
            "evalId": fake_eval_id,
            "name": "Updated Eval",
            "description": "Updated Description",
            "active": True,
            "agent_ids": [],
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

