"""Route tests for POST /api/v3/parameters/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_parameters(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameters list with mappings."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/parameters/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "parameters" in data
    assert "department_mapping" in data
    assert isinstance(data["parameters"], list)
    assert isinstance(data["department_mapping"], dict)
    assert len(data["parameters"]) >= 0

    # If there are parameters, verify structure
    if data["parameters"]:
        for param in data["parameters"]:
            assert "parameter_id" in param
            assert "name" in param
            assert "description" in param
            assert "numerical" in param
            assert "active" in param
            assert "department_ids" in param
            assert "num_items" in param
            assert "sample_items" in param
            assert "can_edit" in param
            assert "can_delete" in param
            assert "can_duplicate" in param
            assert isinstance(param["sample_items"], list)


async def test_list_parameters_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test listing parameters when none exist."""
    profile_id = await get_superadmin_alias(db)

    # Delete all parameters
    await db.execute("DELETE FROM parameters")

    response = await client.post(
        "/api/v3/parameters/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "parameters" in data
    assert isinstance(data["parameters"], list)
    assert len(data["parameters"]) == 0

