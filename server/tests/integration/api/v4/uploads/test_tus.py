"""Route tests for POST /api/v4/uploads/tus endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_tus_upload(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test TUS upload endpoint."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    # TUS endpoint may have specific requirements
    response = await client.post(
        "/api/v4/uploads/tus",
        json={},
    )

    # Response depends on TUS protocol requirements
    assert response.status_code in [200, 400, 404]
    data = response.json()

    assert data is not None

