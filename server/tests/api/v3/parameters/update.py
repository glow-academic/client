"""Route tests for POST /api/v3/parameters/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a parameter with new items."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a parameter first
    parameter_id = await db.fetchval(
        "INSERT INTO parameters(name, description, numerical, active, document_parameter, practice_parameter) "
        "VALUES ('Original Parameter', 'Original Description', false, true, false, false) RETURNING id"
    )

    # Create an initial item
    item_id = await db.fetchval(
        "INSERT INTO parameter_items(parameter_id, name, description, value) "
        "VALUES ($1, 'Original Item', 'Original Item Description', 'original') RETURNING id",
        parameter_id,
    )

    response = await client.post(
        "/api/v3/parameters/update",
        json={
            "parameterId": str(parameter_id),
            "name": "Updated Parameter",
            "description": "Updated Description",
            "numerical": True,
            "active": False,
            "document_parameter": True,
            "practice_parameter": True,
            "department_ids": [str(dept_id)],
            "parameter_items": [
                {
                    "name": "Updated Item 1",
                    "description": "Updated Item 1 Description",
                    "value": "updated1",
                    "department_ids": [str(dept_id)],
                },
                {
                    "name": "Updated Item 2",
                    "description": "Updated Item 2 Description",
                    "value": "updated2",
                    "department_ids": None,
                },
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Parameter 'Updated Parameter' updated successfully"

    # Verify parameter was updated
    parameter = await db.fetchrow(
        "SELECT * FROM parameters WHERE id = $1", parameter_id
    )
    assert parameter is not None
    assert parameter["name"] == "Updated Parameter"
    assert parameter["description"] == "Updated Description"
    assert parameter["numerical"] is True
    assert parameter["active"] is False
    assert parameter["document_parameter"] is True
    assert parameter["practice_parameter"] is True

    # Verify old item was deleted and new items were created
    old_item = await db.fetchrow(
        "SELECT * FROM parameter_items WHERE id = $1", item_id
    )
    assert old_item is None  # Old item should be deleted

    new_items = await db.fetch(
        "SELECT * FROM parameter_items WHERE parameter_id = $1 ORDER BY name",
        parameter_id,
    )
    assert len(new_items) == 2
    assert new_items[0]["name"] == "Updated Item 1"
    assert new_items[1]["name"] == "Updated Item 2"


async def test_update_parameter_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent parameter."""
    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/parameters/update",
        json={
            "parameterId": fake_parameter_id,
            "name": "Updated Parameter",
            "description": "Updated Description",
            "numerical": False,
            "active": True,
            "document_parameter": False,
            "practice_parameter": False,
            "department_ids": None,
            "parameter_items": [],
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

