"""Route tests for POST /api/v4/parameters/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_parameter_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default parameter detail."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/parameters/new",
        json={},
    )

    # May return 200 or 404 depending on whether default parameter exists
    assert response.status_code in [200, 404]

    if response.status_code == 200:
        data = response.json()
        assert data is not None
        assert "name" in data
        assert "description" in data
        assert "numerical" in data
        assert "active" in data
        assert "document_parameter" in data
        assert "simulation_parameter" in data
        assert "department_ids" in data
        assert "parameter_items" in data
        assert "department_mapping" in data
        assert "valid_department_ids" in data
        assert isinstance(data["parameter_items"], list)
        assert isinstance(data["department_mapping"], dict)
        assert isinstance(data["valid_department_ids"], list)
    else:
        data = response.json()
        assert "detail" in data
        assert (
            "not found" in data["detail"].lower()
            or "no default parameter" in data["detail"].lower()
        )
