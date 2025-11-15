"""Route tests for POST /api/v3/parameters/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new parameter with items."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    response = await client.post(
        "/api/v3/parameters/create",
        json={
            "name": "Test Parameter",
            "description": "Test Description",
            "numerical": False,
            "active": True,
            "document_parameter": False,
            "practice_parameter": False,
            "department_ids": [str(dept_id)],
            "parameter_items": [
                {
                    "name": "Item 1",
                    "description": "Item 1 Description",
                    "value": "value1",
                    "department_ids": [str(dept_id)],
                },
                {
                    "name": "Item 2",
                    "description": "Item 2 Description",
                    "value": "value2",
                    "department_ids": None,  # Use parameter-level department_ids
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parameterId" in data
    assert data["message"] == "Parameter 'Test Parameter' created successfully"

    # Verify parameter was created in database
    parameter = await db.fetchrow(
        "SELECT * FROM parameters WHERE id = $1", data["parameterId"]
    )
    assert parameter is not None
    assert parameter["name"] == "Test Parameter"
    assert parameter["description"] == "Test Description"
    assert parameter["numerical"] is False
    assert parameter["active"] is True

    # Verify parameter items were created
    items = await db.fetch(
        "SELECT * FROM parameter_items WHERE parameter_id = $1 ORDER BY name",
        data["parameterId"],
    )
    assert len(items) == 2
    assert items[0]["name"] == "Item 1"
    assert items[1]["name"] == "Item 2"

    # Verify department links were created for items
    item1_id = str(items[0]["id"])
    dept_links = await db.fetch(
        "SELECT * FROM parameter_item_departments WHERE parameter_item_id = $1 AND active = true",
        item1_id,
    )
    assert len(dept_links) == 1
    assert str(dept_links[0]["department_id"]) == str(dept_id)

    # Item 2 should also have department links (from parameter-level)
    item2_id = str(items[1]["id"])
    dept_links2 = await db.fetch(
        "SELECT * FROM parameter_item_departments WHERE parameter_item_id = $1 AND active = true",
        item2_id,
    )
    assert len(dept_links2) == 1
    assert str(dept_links2[0]["department_id"]) == str(dept_id)


async def test_create_parameter_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a parameter with minimal fields."""
    response = await client.post(
        "/api/v3/parameters/create",
        json={
            "name": "Minimal Parameter",
            "description": "Minimal Description",
            "numerical": True,
            "active": True,
            "document_parameter": False,
            "practice_parameter": False,
            "department_ids": None,
            "parameter_items": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parameterId" in data

    # Verify parameter was created
    parameter = await db.fetchrow(
        "SELECT * FROM parameters WHERE id = $1", data["parameterId"]
    )
    assert parameter is not None
    assert parameter["name"] == "Minimal Parameter"
    assert parameter["numerical"] is True

    # Verify no items were created
    items = await db.fetch(
        "SELECT * FROM parameter_items WHERE parameter_id = $1", data["parameterId"]
    )
    assert len(items) == 0
