"""Route tests for POST /api/v4/artifacts/departments/get in new mode."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_department_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/departments/get",
        json={"department_id": None, "draft_id": None},
    )

    assert response.status_code == 200
    data = response.json()
    assert "names" in data
    assert "descriptions" in data
    assert "flags" in data
    assert "settings" in data
    assert "group_id" in data
    assert "basic_show_ai_generate" in data

