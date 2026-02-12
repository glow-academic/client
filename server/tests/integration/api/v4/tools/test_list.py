"""Route tests for POST /api/v4/artifacts/tools/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_tools(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting tools list."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/tools/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "tools" in data
    assert isinstance(data["tools"], list)
    assert len(data["tools"]) >= 0
    assert "total_count" in data

    # If there are tools, verify structure
    if data["tools"]:
        for tool in data["tools"]:
            assert "tool_id" in tool
            assert "name" in tool
            assert "description" in tool
            assert "active" in tool
            assert "updated_at" in tool
            assert "can_edit" in tool
            assert "can_delete" in tool
            assert "can_duplicate" in tool


async def test_list_tools_with_search(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test tools list with search filter."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/tools/list",
        json={"search": "nonexistent_tool_xyz"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "tools" in data
    assert isinstance(data["tools"], list)
    assert data["total_count"] == 0


async def test_list_tools_with_pagination(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test tools list with pagination."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/tools/list",
        json={"page_size": 1, "page_offset": 0},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "tools" in data
    assert isinstance(data["tools"], list)
    assert len(data["tools"]) <= 1
    assert "total_count" in data
