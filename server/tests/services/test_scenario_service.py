"""
Tests for scenario_service - list and search methods.
"""

import asyncpg
import pytest
from app.schemas.scenarios import ScenariosFilters
from app.services.scenario_service import ScenarioService

# --- Helper Functions ---


async def get_test_dept_id(db: asyncpg.Connection) -> str:
    """Get a test department ID from the database."""
    result = await db.fetchrow("SELECT id FROM departments WHERE active = true LIMIT 1")
    if not result:
        raise ValueError("No departments found in test database")
    return str(result['id'])


async def get_test_profile_id(db: asyncpg.Connection) -> str:
    """Get a test profile ID from the database."""
    result = await db.fetchrow("SELECT id FROM profiles LIMIT 1")
    if not result:
        raise ValueError("No profiles found in test database")
    return str(result['id'])


# --- Tests ---


@pytest.mark.asyncio
async def test_get_scenarios_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenarios list with embedded mappings."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = ScenariosFilters(
        departmentIds=[dept_id],
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = ScenarioService(db)
    result = await svc.get_scenarios_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, 'scenarios')
    assert hasattr(result, 'objective_mapping')
    assert hasattr(result, 'parameter_item_mapping')
    assert hasattr(result, 'cohort_mapping')
    assert hasattr(result, 'persona_mapping')

    # Check that scenarios is a list (could be empty)
    assert isinstance(result.scenarios, list)
    assert len(result.scenarios) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.objective_mapping, dict)
    assert isinstance(result.parameter_item_mapping, dict)
    assert isinstance(result.cohort_mapping, dict)
    assert isinstance(result.persona_mapping, dict)

    # If scenarios exist, check basic fields
    if result.scenarios:
        scenario = result.scenarios[0]
        assert hasattr(scenario, 'scenario_id')
        assert hasattr(scenario, 'title')
        assert hasattr(scenario, 'objective_ids')
        assert hasattr(scenario, 'parameter_item_ids')
        assert hasattr(scenario, 'cohort_ids')
        assert isinstance(scenario.objective_ids, list)
        assert isinstance(scenario.parameter_item_ids, list)
        assert isinstance(scenario.cohort_ids, list)


@pytest.mark.asyncio
async def test_get_scenarios_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenarios list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = ScenariosFilters(
        departmentIds=[],
        profileId=profile_id
    )

    # Execute
    svc = ScenarioService(db)
    result = await svc.get_scenarios_list(filters)

    # Assert - Should return empty list but valid structure
    assert result is not None
    assert isinstance(result.scenarios, list)
    assert len(result.scenarios) == 0
    assert isinstance(result.objective_mapping, dict)
    assert isinstance(result.parameter_item_mapping, dict)
    assert isinstance(result.cohort_mapping, dict)
    assert isinstance(result.persona_mapping, dict)


@pytest.mark.asyncio
async def test_search_scenarios(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching scenarios by name."""
    # Setup
    svc = ScenarioService(db)

    # Get a scenario name to search for
    scenario_result = await db.fetchrow("SELECT name FROM scenarios LIMIT 1")

    if scenario_result and scenario_result['name']:
        # Use first word of name as search query
        search_query = scenario_result['name'].split()[0]

        # Execute
        result = await svc.search_scenarios(search_query, limit=10)

        # Assert - Check basic structure
        assert isinstance(result, list)
        assert len(result) >= 0

        # If results exist, check structure
        if result:
            item = result[0]
            assert 'id' in item
            assert 'name' in item
            assert 'score' in item
            assert 'persona_id' in item
            assert 'default_scenario' in item
            assert isinstance(item['score'], (int, float))
    else:
        # No scenarios in database, just test empty search
        result = await svc.search_scenarios("nonexistent", limit=10)
        assert isinstance(result, list)
        assert len(result) == 0


@pytest.mark.asyncio
async def test_search_scenarios_empty_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching with empty query returns empty list."""
    # Setup
    svc = ScenarioService(db)

    # Execute - Empty search query
    result = await svc.search_scenarios("", limit=10)

    # Assert - Should return empty list
    assert isinstance(result, list)
    assert len(result) == 0


@pytest.mark.asyncio
async def test_search_scenarios_limit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching scenarios respects limit parameter."""
    # Setup
    svc = ScenarioService(db)

    # Execute - Search with small limit
    result = await svc.search_scenarios("scenario", limit=2)

    # Assert - Should not exceed limit
    assert isinstance(result, list)
    assert len(result) <= 2
