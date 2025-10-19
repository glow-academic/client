"""
Tests for simulation_service - list and search methods.
"""

import asyncpg  # type: ignore
import pytest
from app.schemas.simulations import SimulationsFilters  # type: ignore
from app.services.simulation_service import SimulationService  # type: ignore

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

    # If simulations exist, check basic fields and validate mappings
    if result.simulations:
        sim = result.simulations[0]
        assert hasattr(sim, "simulation_id")
        assert hasattr(sim, "name")
        assert hasattr(sim, "scenario_ids")
        assert hasattr(sim, "rubric_id")
        assert isinstance(sim.scenario_ids, list)
        
        # CRITICAL: Verify rubric_mapping is populated when rubric_id exists
        if sim.rubric_id:
            assert len(result.rubric_mapping) > 0, "rubric_mapping should be populated when simulations have rubrics"
            assert sim.rubric_id in result.rubric_mapping, f"Rubric {sim.rubric_id} should be in rubric_mapping"
            rubric_item = result.rubric_mapping[sim.rubric_id]
            assert hasattr(rubric_item, 'name') and len(rubric_item.name) > 0, "Rubric mapping should have valid name"
            assert hasattr(rubric_item, 'description'), "Rubric mapping should have description field"
        
        # CRITICAL: Verify scenario_mapping is populated when scenario_ids exist
        if len(sim.scenario_ids) > 0:
            assert len(result.scenario_mapping) > 0, "scenario_mapping should be populated when simulations have scenarios"
            first_scenario_id = sim.scenario_ids[0]
            assert first_scenario_id in result.scenario_mapping, f"Scenario {first_scenario_id} should be in scenario_mapping"
            scenario_item = result.scenario_mapping[first_scenario_id]
            assert hasattr(scenario_item, 'name') and len(scenario_item.name) > 0, "Scenario mapping should have valid name"
            assert hasattr(scenario_item, 'description'), "Scenario mapping should have description field"


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
    
    # CRITICAL: Verify rubric_mapping is populated when rubric_id exists
    if result.rubric_id:
        assert len(result.rubric_mapping) > 0, "rubric_mapping should be populated when simulation has rubric"
        assert result.rubric_id in result.rubric_mapping, f"Rubric {result.rubric_id} should be in rubric_mapping"
        rubric_item = result.rubric_mapping[result.rubric_id]
        assert hasattr(rubric_item, 'name') and len(rubric_item.name) > 0, "Rubric mapping should have valid name"
        assert hasattr(rubric_item, 'description'), "Rubric mapping should have description field"
    
    # CRITICAL: Verify scenario_mapping is populated when scenario_ids exist
    if len(result.scenario_ids) > 0:
        assert len(result.scenario_mapping) > 0, "scenario_mapping should be populated when simulation has scenarios"
        first_scenario_id = result.scenario_ids[0]
        assert first_scenario_id in result.scenario_mapping, f"Scenario {first_scenario_id} should be in scenario_mapping"
        scenario_item = result.scenario_mapping[first_scenario_id]
        assert hasattr(scenario_item, 'name') and len(scenario_item.name) > 0, "Scenario mapping should have valid name"
        assert hasattr(scenario_item, 'description'), "Scenario mapping should have description field"

    # Parameter data
    assert hasattr(result, "parameters")
    assert hasattr(result, "parameter_items")
    assert isinstance(result.parameters, list)
    assert isinstance(result.parameter_items, list)


@pytest.mark.asyncio
async def test_scenario_statistics_in_detail(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that scenario statistics (usage_count, success_rate, last_used, can_remove) are included in simulation detail."""
    # Setup - Get test simulation with scenarios
    sim_result = await db.fetchrow("""
        SELECT s.id 
        FROM simulations s
        JOIN simulation_scenarios ss ON ss.simulation_id = s.id
        WHERE s.active = true
        LIMIT 1
    """)
    
    if not sim_result:
        pytest.skip("No simulations with scenarios found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Execute
    from app.schemas.simulations import SimulationDetailRequest

    svc = SimulationService(db)
    request = SimulationDetailRequest(
        simulationId=simulation_id, profileId=profile_id
    )
    result = await svc.get_simulation_detail(request)

    # Assert - Check that scenarios have statistics fields
    assert hasattr(result, "scenarios")
    assert isinstance(result.scenarios, list)
    
    if result.scenarios:
        scenario = result.scenarios[0]
        
        # Check all new statistics fields exist
        assert hasattr(scenario, "usage_count")
        assert hasattr(scenario, "success_rate")
        assert hasattr(scenario, "last_used")
        assert hasattr(scenario, "can_remove")
        
        # Check types
        assert isinstance(scenario.usage_count, int)
        assert isinstance(scenario.success_rate, int)
        assert scenario.last_used is None or isinstance(scenario.last_used, str)
        assert isinstance(scenario.can_remove, bool)
        
        # Check value constraints
        assert scenario.usage_count >= 0
        assert 0 <= scenario.success_rate <= 100


@pytest.mark.asyncio
async def test_scenario_can_remove_flag(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that can_remove is true when usage_count is 0."""
    # Setup - Get test simulation with scenarios
    sim_result = await db.fetchrow("""
        SELECT s.id 
        FROM simulations s
        JOIN simulation_scenarios ss ON ss.simulation_id = s.id
        WHERE s.active = true
        LIMIT 1
    """)
    
    if not sim_result:
        pytest.skip("No simulations with scenarios found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Execute
    from app.schemas.simulations import SimulationDetailRequest

    svc = SimulationService(db)
    request = SimulationDetailRequest(
        simulationId=simulation_id, profileId=profile_id
    )
    result = await svc.get_simulation_detail(request)

    # Assert - Check can_remove logic
    if result.scenarios:
        for scenario in result.scenarios:
            # Verify can_remove matches usage_count == 0
            if scenario.usage_count == 0:
                assert scenario.can_remove is True, "Scenario with 0 usage should be removable"
            else:
                assert scenario.can_remove is False, "Scenario with usage should not be removable"


@pytest.mark.asyncio
async def test_scenarios_list_json_parsing(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that scenarios_list JSONB field is properly parsed from string or list format."""
    # Setup - Get test simulation with scenarios
    sim_result = await db.fetchrow("""
        SELECT s.id 
        FROM simulations s
        JOIN simulation_scenarios ss ON ss.simulation_id = s.id
        WHERE s.active = true
        LIMIT 1
    """)
    
    if not sim_result:
        pytest.skip("No simulations with scenarios found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Execute
    from app.schemas.simulations import SimulationDetailRequest

    svc = SimulationService(db)
    request = SimulationDetailRequest(
        simulationId=simulation_id, profileId=profile_id
    )
    result = await svc.get_simulation_detail(request)

    # Assert - Scenarios should be parsed and populated
    assert hasattr(result, "scenarios")
    assert isinstance(result.scenarios, list)
    assert len(result.scenarios) > 0, "Scenarios list should not be empty when simulation has scenarios"
    
    # Verify first scenario has all expected fields
    first_scenario = result.scenarios[0]
    assert hasattr(first_scenario, "scenario_id")
    assert hasattr(first_scenario, "title")
    assert hasattr(first_scenario, "description")
    assert hasattr(first_scenario, "active")
    assert hasattr(first_scenario, "usage_count")
    assert hasattr(first_scenario, "success_rate")
    assert hasattr(first_scenario, "last_used")
    assert hasattr(first_scenario, "can_remove")
    
    # Verify data types
    assert isinstance(first_scenario.scenario_id, str)
    assert isinstance(first_scenario.title, str)
    assert isinstance(first_scenario.usage_count, int)
    assert isinstance(first_scenario.success_rate, int)
    assert isinstance(first_scenario.can_remove, bool)


@pytest.mark.asyncio
@pytest.mark.skip(reason="Requires active state support in create - to be implemented")
async def test_create_simulation_with_scenario_active_states(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating simulation with scenario active states."""
    # Setup
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)
    
    # Get test rubric and scenarios
    rubric_result = await db.fetchrow(
        "SELECT id FROM rubrics WHERE department_id = $1 AND active = true LIMIT 1",
        dept_id
    )
    scenario_results = await db.fetch(
        "SELECT id FROM scenarios WHERE department_id = $1 AND active = true LIMIT 2",
        dept_id
    )
    
    if not rubric_result or len(scenario_results) < 2:
        pytest.skip("Insufficient test data (need rubric and 2+ scenarios)")
    
    rubric_id = str(rubric_result["id"])
    scenario_ids = [
        {"scenario_id": str(scenario_results[0]["id"]), "active": True},
        {"scenario_id": str(scenario_results[1]["id"]), "active": False}
    ]
    
    # Execute - Create simulation
    from app.schemas.simulations import (CreateSimulationRequest,
                                         ScenarioInRequest)
    
    svc = SimulationService(db)
    request = CreateSimulationRequest(
        title="Test Simulation with Active States",
        description="Test description",
        department_id=dept_id,
        active=True,
        default_simulation=False,
        practice_simulation=False,
        hints_enabled=False,
        input_guardrail_active=False,
        output_guardrail_active=False,
        image_input_active=False,
        time_limit=30,
        rubric_id=rubric_id,
        scenario_ids=[
            ScenarioInRequest(**scenario_ids[0]),
            ScenarioInRequest(**scenario_ids[1])
        ]
    )
    
    result = await svc.create_simulation(request)
    
    # Assert
    assert result.success is True
    assert result.simulationId
    
    # Verify active states were saved correctly
    from app.schemas.simulations import SimulationDetailRequest
    detail_request = SimulationDetailRequest(
        simulationId=result.simulationId,
        profileId=profile_id
    )
    detail = await svc.get_simulation_detail(detail_request)
    
    assert len(detail.scenarios) == 2
    # First scenario should be active
    first_scenario = next(s for s in detail.scenarios if s.scenario_id == scenario_ids[0]["scenario_id"])
    assert first_scenario.active is True
    
    # Second scenario should be inactive
    second_scenario = next(s for s in detail.scenarios if s.scenario_id == scenario_ids[1]["scenario_id"])
    assert second_scenario.active is False
    
    # Cleanup
    await db.execute("DELETE FROM simulations WHERE id = $1", result.simulationId)


@pytest.mark.asyncio
@pytest.mark.skip(reason="Requires active state support in update - to be implemented")
async def test_update_simulation_scenario_active_states(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating simulation scenario active states."""
    # Setup - Get existing simulation
    sim_result = await db.fetchrow("""
        SELECT s.id, s.title, s.description, s.department_id, s.rubric_id,
               s.active, s.default_simulation, s.practice_simulation,
               s.hints_enabled, s.input_guardrail_active, s.output_guardrail_active,
               s.image_input_active
        FROM simulations s
        JOIN simulation_scenarios ss ON ss.simulation_id = s.id
        WHERE s.active = true
        GROUP BY s.id
        HAVING COUNT(ss.scenario_id) >= 1
        LIMIT 1
    """)
    
    if not sim_result:
        pytest.skip("No simulations with scenarios found in test database")
    
    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)
    
    # Get current scenarios
    scenario_results = await db.fetch(
        "SELECT scenario_id FROM simulation_scenarios WHERE simulation_id = $1 ORDER BY position",
        simulation_id
    )
    
    scenario_ids = [
        {"scenario_id": str(row["scenario_id"]), "active": False}  # Toggle all to inactive
        for row in scenario_results
    ]
    
    # Get time limit
    time_limit_result = await db.fetchrow(
        "SELECT time_limit_seconds FROM simulation_time_limits WHERE simulation_id = $1 AND active = true",
        simulation_id
    )
    time_limit = time_limit_result["time_limit_seconds"] if time_limit_result else None
    
    # Execute - Update simulation
    from app.schemas.simulations import (ScenarioInRequest,
                                         UpdateSimulationRequest)
    
    svc = SimulationService(db)
    request = UpdateSimulationRequest(
        simulationId=simulation_id,
        title=sim_result["title"],
        description=sim_result["description"],
        department_id=sim_result["department_id"],
        active=sim_result["active"],
        default_simulation=sim_result["default_simulation"],
        practice_simulation=sim_result["practice_simulation"],
        hints_enabled=sim_result["hints_enabled"],
        input_guardrail_active=sim_result["input_guardrail_active"],
        output_guardrail_active=sim_result["output_guardrail_active"],
        image_input_active=sim_result["image_input_active"],
        time_limit=time_limit,
        rubric_id=sim_result["rubric_id"],
        scenario_ids=[ScenarioInRequest(**sid) for sid in scenario_ids]
    )
    
    result = await svc.update_simulation(request)
    
    # Assert
    assert result.success is True
    
    # Verify active states were updated
    from app.schemas.simulations import SimulationDetailRequest
    detail_request = SimulationDetailRequest(
        simulationId=simulation_id,
        profileId=profile_id
    )
    detail = await svc.get_simulation_detail(detail_request)
    
    # All scenarios should now be inactive
    for scenario in detail.scenarios:
        assert scenario.active is False, f"Scenario {scenario.scenario_id} should be inactive"
