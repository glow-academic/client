"""Route tests for POST /api/v3/practice endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def test_get_practice_overview_basic(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test basic practice overview functionality."""
    # Setup
    dept_id = await get_cs_dept_id(db)
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/practice",
        json={
            "profileId": profile_id,
            "departmentIds": [dept_id],
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Check basic response structure
    assert "mode" in data
    assert "hasData" in data
    assert "items" in data
    assert "history" in data
    assert "simulation_mapping" in data
    assert "persona_mapping" in data
    assert "scenario_mapping" in data
    assert "parameter_mapping" in data
    assert "parameter_item_mapping" in data
    assert "standard_groups_mapping" in data
    assert "standards_mapping" in data

    # Check types
    assert data["mode"] == "practice"
    assert isinstance(data["hasData"], bool)
    assert isinstance(data["items"], list)
    assert isinstance(data["history"], list)
    assert isinstance(data["simulation_mapping"], dict)
    assert isinstance(data["persona_mapping"], dict)
    assert isinstance(data["scenario_mapping"], dict)
    assert isinstance(data["parameter_mapping"], dict)
    assert isinstance(data["parameter_item_mapping"], dict)
    assert isinstance(data["standard_groups_mapping"], dict)
    assert isinstance(data["standards_mapping"], dict)


async def test_get_practice_overview_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview with no department filter."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/practice",
        json={
            "profileId": profile_id,
            "departmentIds": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["mode"] == "practice"
    assert isinstance(data["items"], list)
    assert isinstance(data["history"], list)


async def test_get_practice_overview_empty_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview with empty department array."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/practice",
        json={
            "profileId": profile_id,
            "departmentIds": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["mode"] == "practice"
    assert isinstance(data["items"], list)
    assert isinstance(data["history"], list)


async def test_get_practice_overview_missing_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview with missing profileId."""
    response = await client.post(
        "/api/v3/practice",
        json={
            "departmentIds": [],
        },
    )

    assert response.status_code == 422  # Validation error


async def test_get_practice_overview_filters_practice_simulations(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that practice overview only returns practice simulations."""
    # Setup - Create a practice simulation and a regular simulation
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Get or create a rubric
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    # Create a practice simulation
    practice_sim_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Practice Sim', 'Test', true, true, $1) RETURNING id",
        rubric_id,
    )

    # Create a regular (non-practice) simulation
    regular_sim_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Regular Sim', 'Test', true, false, $1) RETURNING id",
        rubric_id,
    )

    try:
        response = await client.post(
            "/api/v3/practice",
            json={
                "profileId": profile_id,
                "departmentIds": [dept_id],
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check that only practice simulations are returned
        simulation_ids = [item["id"] for item in data.get("items", [])]
        simulation_mapping_ids = list(data.get("simulation_mapping", {}).keys())

        # Practice simulation should be included
        assert (
            str(practice_sim_id) in simulation_ids
            or str(practice_sim_id) in simulation_mapping_ids
        )

        # Regular simulation should NOT be included
        assert str(regular_sim_id) not in simulation_ids
        assert str(regular_sim_id) not in simulation_mapping_ids

    finally:
        # Cleanup
        await db.execute("DELETE FROM simulations WHERE id = $1", practice_sim_id)
        await db.execute("DELETE FROM simulations WHERE id = $1", regular_sim_id)


async def test_get_practice_overview_items_structure(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that practice items have the correct structure."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    response = await client.post(
        "/api/v3/practice",
        json={
            "profileId": profile_id,
            "departmentIds": [dept_id],
        },
    )

    assert response.status_code == 200
    data = response.json()

    # If items exist, verify structure
    if data.get("items"):
        item = data["items"][0]
        assert "viewMode" in item
        assert "id" in item
        assert "simulationTitle" in item
        assert "simulationName" in item
        assert item["viewMode"] == "practice"
        assert isinstance(item.get("numSessions"), int)
        assert isinstance(item.get("standard_groups"), dict)


async def test_get_practice_overview_filters_practice_parameters(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that practice overview only returns parameters with practice_parameter = true."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    response = await client.post(
        "/api/v3/practice",
        json={
            "profileId": profile_id,
            "departmentIds": [dept_id],
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Check parameter_mapping structure
    assert isinstance(data.get("parameter_mapping"), dict)
    assert isinstance(data.get("parameter_item_mapping"), dict)

    # If parameters exist, verify they have practice_parameter = true
    if data.get("parameter_mapping"):
        parameter_ids = list(data["parameter_mapping"].keys())
        params_from_db = await db.fetch(
            "SELECT id, name, practice_parameter FROM parameters WHERE id = ANY($1::uuid[])",
            parameter_ids,
        )

        # Verify all parameters have practice_parameter = true
        for param in params_from_db:
            assert param["practice_parameter"] is True, (
                f"Parameter {param['name']} (id: {param['id']}) "
                f"has practice_parameter = {param['practice_parameter']}, expected True"
            )

    # If parameter items exist, verify they belong to practice parameters
    if data.get("parameter_item_mapping"):
        parameter_item_ids = list(data["parameter_item_mapping"].keys())
        items_from_db = await db.fetch(
            """
            SELECT pi.id, pi.name, p.practice_parameter 
            FROM parameter_items pi
            JOIN parameters p ON pi.parameter_id = p.id
            WHERE pi.id = ANY($1::uuid[])
            """,
            parameter_item_ids,
        )

        # Verify all parameter items belong to practice parameters
        for item in items_from_db:
            assert item["practice_parameter"] is True, (
                f"Parameter item {item['name']} (id: {item['id']}) "
                f"belongs to a parameter with practice_parameter = {item['practice_parameter']}, expected True"
            )
