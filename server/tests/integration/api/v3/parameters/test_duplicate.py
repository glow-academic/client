"""Route tests for POST /api/v3/parameters/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_parameter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a parameter with items and department links."""
    await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create an original parameter
    original_parameter_id = await db.fetchval(
        "INSERT INTO parameters(name, description, numerical, active, document_parameter, simulation_parameter) "
        "VALUES ('Original Parameter', 'Original Description', false, true, false, false) RETURNING id"
    )

    # Create parameter items with department links
    item1_id = await db.fetchval(
        "INSERT INTO parameter_items(parameter_id, name, description, value) "
        "VALUES ($1, 'Item 1', 'Item 1 Description', 'value1') RETURNING id",
        original_parameter_id,
    )

    item2_id = await db.fetchval(
        "INSERT INTO parameter_items(parameter_id, name, description, value) "
        "VALUES ($1, 'Item 2', 'Item 2 Description', 'value2') RETURNING id",
        original_parameter_id,
    )

    # Link departments to items
    await db.execute(
        "INSERT INTO parameter_item_departments(parameter_item_id, department_id, active) "
        "VALUES ($1, $2, true)",
        item1_id,
        dept_id,
    )

    await db.execute(
        "INSERT INTO parameter_item_departments(parameter_item_id, department_id, active) "
        "VALUES ($1, $2, true)",
        item2_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/parameters/duplicate",
        json={"parameterId": str(original_parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "parameterId" in data
    assert data["message"] == "Parameter 'Original Parameter' duplicated successfully"

    duplicated_parameter_id = data["parameterId"]
    assert duplicated_parameter_id != str(original_parameter_id)

    # Verify duplicated parameter was created
    duplicated_parameter = await db.fetchrow(
        "SELECT * FROM parameters WHERE id = $1", duplicated_parameter_id
    )
    assert duplicated_parameter is not None
    assert duplicated_parameter["name"] == "Original Parameter Copy"
    assert duplicated_parameter["description"] == "Original Description"
    assert duplicated_parameter["numerical"] is False
    assert (
        duplicated_parameter["active"] is False
    )  # Duplicated parameters are inactive by default

    # Verify items were duplicated
    duplicated_items = await db.fetch(
        "SELECT * FROM parameter_items WHERE parameter_id = $1 ORDER BY name",
        duplicated_parameter_id,
    )
    assert len(duplicated_items) == 2
    assert duplicated_items[0]["name"] == "Item 1"
    assert duplicated_items[1]["name"] == "Item 2"

    # Verify department links were copied for items
    dup_item1_id = duplicated_items[0]["id"]
    dup_dept_links1 = await db.fetch(
        "SELECT * FROM parameter_item_departments WHERE parameter_item_id = $1 AND active = true",
        dup_item1_id,
    )
    assert len(dup_dept_links1) == 1
    assert str(dup_dept_links1[0]["department_id"]) == str(dept_id)

    dup_item2_id = duplicated_items[1]["id"]
    dup_dept_links2 = await db.fetch(
        "SELECT * FROM parameter_item_departments WHERE parameter_item_id = $1 AND active = true",
        dup_item2_id,
    )
    assert len(dup_dept_links2) == 1
    assert str(dup_dept_links2[0]["department_id"]) == str(dept_id)


async def test_duplicate_parameter_without_department_links(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a parameter that has no department links."""
    # Create an original parameter without department links
    original_parameter_id = await db.fetchval(
        "INSERT INTO parameters(name, description, numerical, active, document_parameter, simulation_parameter) "
        "VALUES ('No Dept Parameter', 'Test Description', false, true, false, false) RETURNING id"
    )

    # Create parameter items without department links
    await db.execute(
        "INSERT INTO parameter_items(parameter_id, name, description, value) "
        "VALUES ($1, 'Item 1', 'Item 1 Description', 'value1')",
        original_parameter_id,
    )

    response = await client.post(
        "/api/v3/parameters/duplicate",
        json={"parameterId": str(original_parameter_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    duplicated_parameter_id = data["parameterId"]

    # Verify items were duplicated
    duplicated_items = await db.fetch(
        "SELECT * FROM parameter_items WHERE parameter_id = $1",
        duplicated_parameter_id,
    )
    assert len(duplicated_items) == 1

    # Verify no department links were created (since original had none)
    dup_item_id = duplicated_items[0]["id"]
    dup_dept_links = await db.fetch(
        "SELECT * FROM parameter_item_departments WHERE parameter_item_id = $1",
        dup_item_id,
    )
    assert len(dup_dept_links) == 0


async def test_duplicate_parameter_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent parameter."""
    fake_parameter_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/parameters/duplicate",
        json={"parameterId": fake_parameter_id},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
