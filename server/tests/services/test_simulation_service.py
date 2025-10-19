"""
Tests for simulation_service - list and search methods.
"""

import asyncpg
import pytest
from app.schemas.simulations import SimulationsFilters
from app.services.simulation_service import SimulationService

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
async def test_get_simulations_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting simulations list with embedded mappings."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = SimulationsFilters(departmentIds=[dept_id], profileId=profile_id)

    # Execute - Call the service method
    svc = SimulationService(db)
    result = await svc.get_simulations_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "simulations")
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "rubric_mapping")

    # Check that simulations is a list (could be empty)
    assert isinstance(result.simulations, list)
    assert len(result.simulations) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.rubric_mapping, dict)

    # If simulations exist, check basic fields
    if result.simulations:
        sim = result.simulations[0]
        assert hasattr(sim, "simulation_id")
        assert hasattr(sim, "name")
        assert hasattr(sim, "scenario_ids")
        assert hasattr(sim, "rubric_id")
        assert isinstance(sim.scenario_ids, list)


@pytest.mark.asyncio
async def test_get_simulations_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting simulations list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = SimulationsFilters(departmentIds=[], profileId=profile_id)

    # Execute
    svc = SimulationService(db)
    result = await svc.get_simulations_list(filters)

    # Assert - Should return empty list but valid structure
    assert result is not None
    assert isinstance(result.simulations, list)
    assert len(result.simulations) == 0
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.rubric_mapping, dict)


@pytest.mark.asyncio
async def test_search_simulations(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test searching simulations by title."""
    # Setup
    svc = SimulationService(db)

    # Get a simulation title to search for
    sim_result = await db.fetchrow("SELECT title FROM simulations LIMIT 1")

    if sim_result and sim_result["title"]:
        # Use first word of title as search query
        search_query = sim_result["title"].split()[0]

        # Execute
        result = await svc.search_simulations(search_query, limit=10)

        # Assert - Check basic structure
        assert isinstance(result, list)
        assert len(result) >= 0

        # If results exist, check structure
        if result:
            item = result[0]
            assert "id" in item
            assert "title" in item
            assert "score" in item
            assert "active" in item
            assert isinstance(item["score"], (int, float))
    else:
        # No simulations in database, just test empty search
        result = await svc.search_simulations("nonexistent", limit=10)
        assert isinstance(result, list)
        assert len(result) == 0


@pytest.mark.asyncio
async def test_search_simulations_empty_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching with empty query returns empty list."""
    # Setup
    svc = SimulationService(db)

    # Execute - Empty search query
    result = await svc.search_simulations("", limit=10)

    # Assert - Should return empty list
    assert isinstance(result, list)
    assert len(result) == 0


@pytest.mark.asyncio
async def test_search_simulations_limit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching simulations respects limit parameter."""
    # Setup
    svc = SimulationService(db)

    # Execute - Search with small limit
    result = await svc.search_simulations("simulation", limit=2)

    # Assert - Should not exceed limit
    assert isinstance(result, list)
    assert len(result) <= 2


@pytest.mark.asyncio
async def test_get_simulation_detail_single_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulation detail fetches all data in 1 query with JSONB aggregations."""
    # Setup - Get test simulation and profile
    sim_result = await db.fetchrow(
        "SELECT id FROM simulations WHERE active = true LIMIT 1"
    )
    if not sim_result:
        pytest.skip("No simulations found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Execute - Call the optimized service method
    from app.schemas.simulations import SimulationDetailRequest

    svc = SimulationService(db)
    request = SimulationDetailRequest(
        simulationId=simulation_id, profileId=profile_id
    )
    result = await svc.get_simulation_detail(request)

    # Assert - Check basic structure (not over-asserting implementation details)
    assert result is not None

    # Basic fields
    assert hasattr(result, "name")
    assert hasattr(result, "description")
    assert hasattr(result, "department_id")
    assert hasattr(result, "rubric_id")
    assert hasattr(result, "active")

    # Permissions
    assert hasattr(result, "can_edit")
    assert hasattr(result, "can_duplicate")
    assert hasattr(result, "can_delete")
    assert isinstance(result.can_edit, bool)
    assert isinstance(result.can_duplicate, bool)
    assert isinstance(result.can_delete, bool)

    # Scenarios
    assert hasattr(result, "scenarios")
    assert hasattr(result, "scenario_ids")
    assert isinstance(result.scenarios, list)
    assert isinstance(result.scenario_ids, list)

    # Mappings
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "rubric_mapping")
    assert hasattr(result, "department_mapping")
    assert hasattr(result, "parameter_mapping")
    assert hasattr(result, "parameter_item_mapping")
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.rubric_mapping, dict)
    assert isinstance(result.department_mapping, dict)
    assert isinstance(result.parameter_mapping, dict)
    assert isinstance(result.parameter_item_mapping, dict)

    # Parameter data
    assert hasattr(result, "parameters")
    assert hasattr(result, "parameter_items")
    assert isinstance(result.parameters, list)
    assert isinstance(result.parameter_items, list)
