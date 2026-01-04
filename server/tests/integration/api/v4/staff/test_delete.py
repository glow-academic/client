"""Route tests for POST /api/v4/staff/delete endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_staff_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent staff member."""
    await get_superadmin_alias(db)

    fake_profile_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/staff/delete",
        json={"targetProfileId": fake_profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

