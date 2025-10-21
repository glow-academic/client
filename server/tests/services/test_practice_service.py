"""
Tests for practice_service - practice overview methods.
"""

import asyncpg  # type: ignore
import pytest

from app.schemas.analytics import AnalyticsFilters  # type: ignore
from app.services.practice_service import PracticeService  # type: ignore

# --- Helper Functions ---


async def get_test_dept_id(db: asyncpg.Connection) -> str:
    """Get a test department ID from the database."""
    result = await db.fetchrow("SELECT id FROM departments WHERE active = true LIMIT 1")
    if not result:
        raise ValueError("No departments found in test database")
    return str(result["id"])


async def get_test_profile_id(db: asyncpg.Connection) -> str:
    """Get a test profile ID from the database."""
    result = await db.fetchrow("SELECT id FROM profiles LIMIT 1")
    if not result:
        raise ValueError("No profiles found in test database")
    return str(result["id"])


# --- Tests ---


@pytest.mark.asyncio
@pytest.mark.skip(reason="Will implement after verifying service layer logic")
async def test_get_practice_overview_filters_practice_parameters(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that practice overview only returns parameters with practice_parameter = true."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        profileId=profile_id,
        simulationFilters=["practice"],
    )

    # Execute - Call the service method
    svc = PracticeService(db)
    result = await svc.get_practice_overview(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "parameter_mapping")
    assert hasattr(result, "parameter_item_mapping")

    # Check parameter_mapping structure
    assert isinstance(result.parameter_mapping, dict)

    # If parameters exist, verify they have practice_parameter = true
    if result.parameter_mapping:
        # Query the database to verify all returned parameters are practice parameters
        parameter_ids = list(result.parameter_mapping.keys())
        query = """
        SELECT id, name, practice_parameter 
        FROM parameters 
        WHERE id = ANY($1::uuid[])
        """
        params_from_db = await db.fetch(query, parameter_ids)

        # Verify all parameters have practice_parameter = true
        for param in params_from_db:
            assert param["practice_parameter"] is True, (
                f"Parameter {param['name']} (id: {param['id']}) "
                f"has practice_parameter = {param['practice_parameter']}, expected True"
            )

    # Check parameter_item_mapping structure
    assert isinstance(result.parameter_item_mapping, dict)

    # If parameter items exist, verify they belong to practice parameters
    if result.parameter_item_mapping:
        parameter_item_ids = list(result.parameter_item_mapping.keys())
        query = """
        SELECT pi.id, pi.name, p.practice_parameter 
        FROM parameter_items pi
        JOIN parameters p ON pi.parameter_id = p.id
        WHERE pi.id = ANY($1::uuid[])
        """
        items_from_db = await db.fetch(query, parameter_item_ids)

        # Verify all parameter items belong to practice parameters
        for item in items_from_db:
            assert item["practice_parameter"] is True, (
                f"Parameter item {item['name']} (id: {item['id']}) "
                f"belongs to a parameter with practice_parameter = {item['practice_parameter']}, expected True"
            )


@pytest.mark.asyncio
async def test_get_practice_overview_basic(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test basic practice overview functionality."""
    # Setup
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
        profileId=profile_id,
        simulationFilters=["practice"],
    )

    # Execute
    svc = PracticeService(db)
    result = await svc.get_practice_overview(filters)

    # Assert - Check basic response structure
    assert result is not None
    assert hasattr(result, "mode")
    assert hasattr(result, "hasData")
    assert hasattr(result, "items")
    assert hasattr(result, "history")
    assert hasattr(result, "simulation_mapping")
    assert hasattr(result, "persona_mapping")
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "parameter_mapping")
    assert hasattr(result, "parameter_item_mapping")

    # Check types
    assert result.mode == "practice"
    assert isinstance(result.hasData, bool)
    assert isinstance(result.items, list)
    assert isinstance(result.history, list)
    assert isinstance(result.simulation_mapping, dict)
    assert isinstance(result.persona_mapping, dict)
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.parameter_mapping, dict)
    assert isinstance(result.parameter_item_mapping, dict)
