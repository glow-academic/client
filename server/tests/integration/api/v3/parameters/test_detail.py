"""Route tests for POST /api/v3/parameters/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_parameter_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameter detail with all data."""
    profile_id = await get_superadmin_alias(db)

    # Create a parameter first
    parameter_id = await db.fetchval(
        "INSERT INTO parameters(name, description, numerical, active, document_parameter, simulation_parameter) "
        "VALUES ('Test Parameter', 'Test Description', false, true, false, false) RETURNING id"
    )

    response = await client.post(
        "/api/v3/parameters/detail",
        json={"parameterId": str(parameter_id), "profileId": profile_id},
    )

    assert response.status_code == 200
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


async def test_get_parameter_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test parameter detail raises error for non-existent parameter."""
    profile_id = await get_superadmin_alias(db)

    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/parameters/detail",
        json={"parameterId": fake_parameter_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
