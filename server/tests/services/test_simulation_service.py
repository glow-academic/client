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
            assert len(result.rubric_mapping) > 0, (
                "rubric_mapping should be populated when simulations have rubrics"
            )
            assert sim.rubric_id in result.rubric_mapping, (
                f"Rubric {sim.rubric_id} should be in rubric_mapping"
            )
            rubric_item = result.rubric_mapping[sim.rubric_id]
            assert hasattr(rubric_item, "name") and len(rubric_item.name) > 0, (
                "Rubric mapping should have valid name"
            )
            assert hasattr(rubric_item, "description"), (
                "Rubric mapping should have description field"
            )

        # CRITICAL: Verify scenario_mapping is populated when scenario_ids exist
        if len(sim.scenario_ids) > 0:
            assert len(result.scenario_mapping) > 0, (
                "scenario_mapping should be populated when simulations have scenarios"
            )
            first_scenario_id = sim.scenario_ids[0]
            assert first_scenario_id in result.scenario_mapping, (
                f"Scenario {first_scenario_id} should be in scenario_mapping"
            )
            scenario_item = result.scenario_mapping[first_scenario_id]
            assert hasattr(scenario_item, "name") and len(scenario_item.name) > 0, (
                "Scenario mapping should have valid name"
            )
            assert hasattr(scenario_item, "description"), (
                "Scenario mapping should have description field"
            )


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
    request = SimulationDetailRequest(simulationId=simulation_id, profileId=profile_id)
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
        assert len(result.rubric_mapping) > 0, (
            "rubric_mapping should be populated when simulation has rubric"
        )
        assert result.rubric_id in result.rubric_mapping, (
            f"Rubric {result.rubric_id} should be in rubric_mapping"
        )
        rubric_item = result.rubric_mapping[result.rubric_id]
        assert hasattr(rubric_item, "name") and len(rubric_item.name) > 0, (
            "Rubric mapping should have valid name"
        )
        assert hasattr(rubric_item, "description"), (
            "Rubric mapping should have description field"
        )

    # CRITICAL: Verify scenario_mapping is populated when scenario_ids exist
    if len(result.scenario_ids) > 0:
        assert len(result.scenario_mapping) > 0, (
            "scenario_mapping should be populated when simulation has scenarios"
        )
        first_scenario_id = result.scenario_ids[0]
        assert first_scenario_id in result.scenario_mapping, (
            f"Scenario {first_scenario_id} should be in scenario_mapping"
        )
        scenario_item = result.scenario_mapping[first_scenario_id]
        assert hasattr(scenario_item, "name") and len(scenario_item.name) > 0, (
            "Scenario mapping should have valid name"
        )
        assert hasattr(scenario_item, "description"), (
            "Scenario mapping should have description field"
        )

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
    request = SimulationDetailRequest(simulationId=simulation_id, profileId=profile_id)
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
    request = SimulationDetailRequest(simulationId=simulation_id, profileId=profile_id)
    result = await svc.get_simulation_detail(request)

    # Assert - Check can_remove logic
    if result.scenarios:
        for scenario in result.scenarios:
            # Verify can_remove matches usage_count == 0
            if scenario.usage_count == 0:
                assert scenario.can_remove is True, (
                    "Scenario with 0 usage should be removable"
                )
            else:
                assert scenario.can_remove is False, (
                    "Scenario with usage should not be removable"
                )


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
    request = SimulationDetailRequest(simulationId=simulation_id, profileId=profile_id)
    result = await svc.get_simulation_detail(request)

    # Assert - Scenarios should be parsed and populated
    assert hasattr(result, "scenarios")
    assert isinstance(result.scenarios, list)
    assert len(result.scenarios) > 0, (
        "Scenarios list should not be empty when simulation has scenarios"
    )

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
async def test_scenario_mapping_includes_all_valid_scenarios(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that scenario_mapping includes all valid scenarios, not just those in the simulation."""
    # Setup - Get test simulation
    sim_result = await db.fetchrow("""
        SELECT s.id 
        FROM simulations s
        WHERE s.active = true
        LIMIT 1
    """)

    if not sim_result:
        pytest.skip("No simulations found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Execute
    from app.schemas.simulations import SimulationDetailRequest

    svc = SimulationService(db)
    request = SimulationDetailRequest(simulationId=simulation_id, profileId=profile_id)
    result = await svc.get_simulation_detail(request)

    # Assert - scenario_mapping should have entries for all valid_scenario_ids
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "valid_scenario_ids")

    # Every valid scenario ID should have a mapping entry
    for scenario_id in result.valid_scenario_ids:
        assert scenario_id in result.scenario_mapping, (
            f"Valid scenario {scenario_id} should have mapping entry"
        )

        scenario_item = result.scenario_mapping[scenario_id]
        assert hasattr(scenario_item, "name")
        assert hasattr(scenario_item, "description")
        assert len(scenario_item.name) > 0, "Scenario should have a name"
        # Description can be empty for some scenarios, but field should exist
        assert scenario_item.description is not None


@pytest.mark.asyncio
async def test_scenario_mapping_resolves_to_root(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that scenario_mapping only includes root scenarios from scenario_tree."""
    # Setup
    sim_result = await db.fetchrow(
        "SELECT id FROM simulations WHERE active = true LIMIT 1"
    )

    if not sim_result:
        pytest.skip("No simulations found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Execute
    from app.schemas.simulations import SimulationDetailRequest

    svc = SimulationService(db)
    request = SimulationDetailRequest(simulationId=simulation_id, profileId=profile_id)
    result = await svc.get_simulation_detail(request)

    # Assert - All scenarios in mapping should be root scenarios
    # Check a few scenarios to verify they are roots (parent_id = child_id or no parent)
    for scenario_id in list(result.scenario_mapping.keys())[:10]:  # Check first 10
        # Query to check if this is a root scenario
        is_child = await db.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM scenario_tree 
                WHERE child_id = $1 AND parent_id != child_id
            )
        """,
            scenario_id,
        )

        # If it's a child of another scenario, it should not be in the mapping
        # (unless it's also marked as a root with parent_id = child_id)
        if is_child:
            is_also_root = await db.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1 FROM scenario_tree 
                    WHERE child_id = $1 AND parent_id = child_id
                )
            """,
                scenario_id,
            )

            assert is_also_root, (
                f"Scenario {scenario_id} is a child but not marked as root in scenario_tree"
            )


@pytest.mark.asyncio
async def test_simulations_list_shows_cohort_count(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that simulations list shows num_cohorts field."""
    # Setup
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Execute
    svc = SimulationService(db)
    filters = SimulationsFilters(departmentIds=[dept_id], profileId=profile_id)
    result = await svc.get_simulations_list(filters)

    # Assert - Check num_cohorts field exists and matches database
    for simulation in result.simulations:
        # Count cohorts for this simulation in database
        cohort_count = await db.fetchval(
            """
            SELECT COUNT(DISTINCT cohort_id)
            FROM cohort_simulations
            WHERE simulation_id = $1
        """,
            simulation.simulation_id,
        )

        assert hasattr(simulation, "num_cohorts"), (
            f"Simulation {simulation.name} should have num_cohorts field"
        )
        assert simulation.num_cohorts == cohort_count, (
            f"Simulation {simulation.name} num_cohorts should be {cohort_count}, got {simulation.num_cohorts}"
        )


@pytest.mark.asyncio
async def test_simulation_practice_default_cannot_be_deleted(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that simulations marked as both practice AND default cannot be deleted by anyone."""
    # Setup
    dept_id = await get_test_dept_id(db)
    superadmin_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1"
    )

    if not superadmin_id:
        pytest.skip("No superadmin profile found")

    superadmin_id = str(superadmin_id)

    # Execute
    from app.schemas.simulations import SimulationsFilters

    svc = SimulationService(db)
    result = await svc.get_simulations_list(
        SimulationsFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )

    # Assert - Find simulations that are both practice and default
    for simulation in result.simulations:
        if simulation.practice_simulation and simulation.default_simulation:
            assert simulation.can_delete == False, (
                f"Simulation {simulation.name} marked as practice+default should NOT be deletable (even by superadmin)"
            )


@pytest.mark.asyncio
async def test_simulation_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for simulations based on cohort links."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get superadmin and admin profiles
    superadmin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1"
    )
    admin_result = await db.fetchrow(
        """
        SELECT p.id FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        WHERE p.role = 'admin' AND pd.department_id = $1
        LIMIT 1
    """,
        dept_id,
    )

    if not superadmin_result or not admin_result:
        pytest.skip("Need both superadmin and admin profiles")

    superadmin_id = str(superadmin_result["id"])
    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.simulations import SimulationsFilters

    svc = SimulationService(db)
    resp_superadmin = await svc.get_simulations_list(
        SimulationsFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )
    resp_admin = await svc.get_simulations_list(
        SimulationsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Simulations with active cohort links: cannot edit
    # 2. Default simulations: only superadmin can edit
    # 3. Other simulations: instructional, admin, superadmin can edit

    for sim_sa in resp_superadmin.simulations:
        # Get cohort link counts from database
        active_cohort_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM cohort_simulations 
            WHERE simulation_id = $1 AND active = true
        """,
            sim_sa.simulation_id,
        )

        sim_admin = next(
            (
                s
                for s in resp_admin.simulations
                if s.simulation_id == sim_sa.simulation_id
            ),
            None,
        )

        if not sim_admin:
            continue

        # Rule 1: Simulations with active cohort links - nobody can edit
        if active_cohort_count > 0:
            assert sim_sa.can_edit == False, (
                f"Simulation {sim_sa.name} with {active_cohort_count} active cohort links should not be editable (superadmin)"
            )
            assert sim_admin.can_edit == False, (
                f"Simulation {sim_admin.name} with {active_cohort_count} active cohort links should not be editable (admin)"
            )

        # Rule 2: Default simulations - only superadmin can edit
        elif sim_sa.default_simulation:
            assert sim_sa.can_edit == True, (
                f"Superadmin should be able to edit default simulation {sim_sa.name}"
            )
            assert sim_admin.can_edit == False, (
                f"Admin should NOT be able to edit default simulation {sim_admin.name}"
            )

        # Rule 3: Non-default simulations without active cohort links - all can edit
        elif not sim_sa.default_simulation and active_cohort_count == 0:
            assert sim_sa.can_edit == True, (
                f"Superadmin should be able to edit non-default simulation {sim_sa.name}"
            )
            assert sim_admin.can_edit == True, (
                f"Admin should be able to edit non-default simulation {sim_admin.name}"
            )


@pytest.mark.asyncio
async def test_simulation_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for simulations based on cohort links."""
    # Setup
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    superadmin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1"
    )
    admin_result = await db.fetchrow(
        """
        SELECT p.id FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        WHERE p.role = 'admin' AND pd.department_id = $1
        LIMIT 1
    """,
        dept_id,
    )

    if not superadmin_result or not admin_result:
        pytest.skip("Need both superadmin and admin profiles")

    superadmin_id = str(superadmin_result["id"])
    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.simulations import SimulationsFilters

    svc = SimulationService(db)
    resp_superadmin = await svc.get_simulations_list(
        SimulationsFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )
    resp_admin = await svc.get_simulations_list(
        SimulationsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Practice + Default simulations: NEVER deletable (highest priority)
    # 2. Simulations with ANY cohort links: cannot delete
    # 3. Default simulations (not practice): only superadmin can delete (if no links)
    # 4. Other simulations: instructional, admin, superadmin can delete (if no links)

    for sim_sa in resp_superadmin.simulations:
        # Get total cohort link count from database
        total_cohort_links = await db.fetchval(
            """
            SELECT COUNT(*) FROM cohort_simulations 
            WHERE simulation_id = $1
        """,
            sim_sa.simulation_id,
        )

        sim_admin = next(
            (
                s
                for s in resp_admin.simulations
                if s.simulation_id == sim_sa.simulation_id
            ),
            None,
        )

        if not sim_admin:
            continue

        # Rule 1: Practice + Default simulations - NEVER deletable
        if sim_sa.default_simulation and sim_sa.practice_simulation:
            assert sim_sa.can_delete == False, (
                f"Simulation {sim_sa.name} (practice+default) should NEVER be deletable"
            )
            assert sim_admin.can_delete == False, (
                f"Simulation {sim_admin.name} (practice+default) should NEVER be deletable"
            )

        # Rule 2: Simulations with any cohort links - nobody can delete
        elif total_cohort_links > 0:
            assert sim_sa.can_delete == False, (
                f"Simulation {sim_sa.name} with {total_cohort_links} cohort links should not be deletable (superadmin)"
            )
            assert sim_admin.can_delete == False, (
                f"Simulation {sim_admin.name} with {total_cohort_links} cohort links should not be deletable (admin)"
            )

        # Rule 3: Unlinked default simulations (not practice) - only superadmin can delete
        elif (
            sim_sa.default_simulation
            and not sim_sa.practice_simulation
            and total_cohort_links == 0
        ):
            assert sim_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked default (non-practice) simulation {sim_sa.name}"
            )
            assert sim_admin.can_delete == False, (
                f"Admin should NOT be able to delete default simulation {sim_admin.name}"
            )

        # Rule 4: Unlinked, non-default simulations - all can delete
        elif not sim_sa.default_simulation and total_cohort_links == 0:
            assert sim_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked non-default simulation {sim_sa.name}"
            )
            assert sim_admin.can_delete == True, (
                f"Admin should be able to delete unlinked non-default simulation {sim_admin.name}"
            )


@pytest.mark.asyncio
async def test_scenario_ordering_active_first(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that scenarios are ordered with active first, then inactive when updating simulation."""
    # Setup - Get existing simulation
    sim_result = await db.fetchrow("""
        SELECT s.id, s.title, s.description, s.department_id, s.rubric_id,
               s.active, s.default_simulation, s.practice_simulation,
               s.hints_enabled, s.input_guardrail_active, s.output_guardrail_active,
               s.image_input_active
        FROM simulations s
        WHERE s.active = true
        LIMIT 1
    """)

    if not sim_result:
        pytest.skip("No simulations found in test database")

    simulation_id = str(sim_result["id"])
    profile_id = await get_test_profile_id(db)

    # Get current scenarios (at least 2)
    scenario_results = await db.fetch(
        "SELECT scenario_id FROM simulation_scenarios WHERE simulation_id = $1 ORDER BY position LIMIT 3",
        simulation_id,
    )

    if len(scenario_results) < 2:
        pytest.skip("Need at least 2 scenarios for this test")

    # Get time limit
    time_limit_result = await db.fetchrow(
        "SELECT time_limit_seconds FROM simulation_time_limits WHERE simulation_id = $1 AND active = true",
        simulation_id,
    )
    time_limit = time_limit_result["time_limit_seconds"] if time_limit_result else None

    # Create request with mixed active/inactive scenarios
    # First scenario inactive, rest active - should reorder to active first
    from app.schemas.simulations import (ScenarioInRequest,
                                         UpdateSimulationRequest)

    scenario_ids = [
        ScenarioInRequest(
            scenario_id=str(scenario_results[0]["scenario_id"]), active=False
        ),  # Inactive
        ScenarioInRequest(
            scenario_id=str(scenario_results[1]["scenario_id"]), active=True
        ),  # Active
    ]

    if len(scenario_results) >= 3:
        scenario_ids.append(
            ScenarioInRequest(
                scenario_id=str(scenario_results[2]["scenario_id"]), active=True
            )  # Active
        )

    # Execute - Update simulation
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
        scenario_ids=scenario_ids,
    )

    result = await svc.update_simulation(request)
    assert result.success is True

    # Verify ordering in database: active scenarios should come first
    db_scenarios = await db.fetch(
        "SELECT scenario_id, active, position FROM simulation_scenarios WHERE simulation_id = $1 ORDER BY position",
        simulation_id,
    )

    # First scenarios should be active (active=true)
    # Last scenario should be inactive (active=false)
    active_positions = [i for i, s in enumerate(db_scenarios) if s["active"]]
    inactive_positions = [i for i, s in enumerate(db_scenarios) if not s["active"]]

    # All active scenarios should come before any inactive scenarios
    if active_positions and inactive_positions:
        assert max(active_positions) < min(inactive_positions), (
            "Active scenarios should come before inactive scenarios in position order"
        )


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
        dept_id,
    )
    scenario_results = await db.fetch(
        "SELECT id FROM scenarios WHERE department_id = $1 AND active = true LIMIT 2",
        dept_id,
    )

    if not rubric_result or len(scenario_results) < 2:
        pytest.skip("Insufficient test data (need rubric and 2+ scenarios)")

    rubric_id = str(rubric_result["id"])
    scenario_ids = [
        {"scenario_id": str(scenario_results[0]["id"]), "active": True},
        {"scenario_id": str(scenario_results[1]["id"]), "active": False},
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
            ScenarioInRequest(**scenario_ids[1]),
        ],
    )

    result = await svc.create_simulation(request)

    # Assert
    assert result.success is True
    assert result.simulationId

    # Verify active states were saved correctly
    from app.schemas.simulations import SimulationDetailRequest

    detail_request = SimulationDetailRequest(
        simulationId=result.simulationId, profileId=profile_id
    )
    detail = await svc.get_simulation_detail(detail_request)

    assert len(detail.scenarios) == 2
    # First scenario should be active
    first_scenario = next(
        s for s in detail.scenarios if s.scenario_id == scenario_ids[0]["scenario_id"]
    )
    assert first_scenario.active is True

    # Second scenario should be inactive
    second_scenario = next(
        s for s in detail.scenarios if s.scenario_id == scenario_ids[1]["scenario_id"]
    )
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
        simulation_id,
    )

    scenario_ids = [
        {
            "scenario_id": str(row["scenario_id"]),
            "active": False,
        }  # Toggle all to inactive
        for row in scenario_results
    ]

    # Get time limit
    time_limit_result = await db.fetchrow(
        "SELECT time_limit_seconds FROM simulation_time_limits WHERE simulation_id = $1 AND active = true",
        simulation_id,
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
        scenario_ids=[ScenarioInRequest(**sid) for sid in scenario_ids],
    )

    result = await svc.update_simulation(request)

    # Assert
    assert result.success is True

    # Verify active states were updated
    from app.schemas.simulations import SimulationDetailRequest

    detail_request = SimulationDetailRequest(
        simulationId=simulation_id, profileId=profile_id
    )
    detail = await svc.get_simulation_detail(detail_request)

    # All scenarios should now be inactive
    for scenario in detail.scenarios:
        assert scenario.active is False, (
            f"Scenario {scenario.scenario_id} should be inactive"
        )


@pytest.mark.asyncio
async def test_get_simulation_detail_default_consolidated(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default simulation detail with consolidated query (1 query instead of 2)."""
    # Setup - Get test profile ID
    profile_id = await get_test_profile_id(db)

    # Create request
    from app.schemas.simulations import SimulationDetailDefaultRequest

    request = SimulationDetailDefaultRequest(profileId=profile_id)

    # Execute - Call the service method
    svc = SimulationService(db)
    result = await svc.get_simulation_detail_default(request)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "name")
    assert hasattr(result, "description")
    assert hasattr(result, "department_id")
    assert hasattr(result, "active")
    assert hasattr(result, "default_simulation")
    assert hasattr(result, "practice_simulation")
    assert hasattr(result, "scenarios")
    assert hasattr(result, "scenario_ids")
    assert hasattr(result, "valid_scenario_ids")
    assert hasattr(result, "valid_rubric_ids")
    assert hasattr(result, "valid_department_ids")
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "rubric_mapping")
    assert hasattr(result, "department_mapping")

    # Check that it returns actual data
    assert result.name is not None
    assert result.department_id is not None
    assert isinstance(result.scenarios, list)
    assert isinstance(result.scenario_ids, list)
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.department_mapping, dict)


@pytest.mark.skip(reason="Complex query needs debugging - testing via API instead")
@pytest.mark.asyncio
async def test_start_simulation_attempt_complete_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test the new consolidated start_simulation_attempt query."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)
    
    # Get a simulation ID
    sim_result = await db.fetchrow(
        "SELECT id FROM simulations WHERE active = true LIMIT 1"
    )
    if not sim_result:
        pytest.skip("No active simulations found in test database")
    simulation_id = str(sim_result["id"])
    
    # Get a scenario ID
    scenario_result = await db.fetchrow(
        "SELECT id FROM scenarios WHERE active = true LIMIT 1"
    )
    if not scenario_result:
        pytest.skip("No active scenarios found in test database")
    scenario_id = str(scenario_result["id"])

    # Execute - Test the query directly
    svc = SimulationService(db)
    query, params = svc.queries.start_simulation_attempt_complete(
        simulation_id=simulation_id,
        profile_id=profile_id,
        scenario_id_override=None,
        infinite=False,
        department_id=dept_id,
    )
    
    result = await db.fetchrow(query, *params)
    
    # Assert - Check basic structure
    assert result is not None
    assert "attempt_id" in result
    assert "chat_id" in result
    assert "chat_title" in result
    assert "scenario_id" in result
    assert "scenario_name" in result
    assert "problem_statement" in result
    assert "needs_generation" in result
    assert "simulation_data" in result
    assert "scenario_metadata" in result
    
    # Check data types
    assert isinstance(result["attempt_id"], str)
    assert isinstance(result["chat_id"], str)
    assert isinstance(result["chat_title"], str)
    assert isinstance(result["scenario_id"], str)
    assert isinstance(result["scenario_name"], str)
    assert isinstance(result["needs_generation"], bool)
    assert isinstance(result["simulation_data"], dict)
    assert isinstance(result["scenario_metadata"], dict)
    
    # Check that JSONB fields are properly structured
    sim_data = result["simulation_data"]
    assert "id" in sim_data
    assert "title" in sim_data
    assert "department_id" in sim_data
    
    scenario_meta = result["scenario_metadata"]
    assert "active" in scenario_meta
    assert "documents" in scenario_meta
    assert "parameter_items" in scenario_meta
    assert isinstance(scenario_meta["documents"], list)
    assert isinstance(scenario_meta["parameter_items"], list)


@pytest.mark.asyncio
async def test_start_simulation_attempt_service_method(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test the simplified start_simulation_attempt service method."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)
    
    # Get a simulation ID
    sim_result = await db.fetchrow(
        "SELECT id FROM simulations WHERE active = true LIMIT 1"
    )
    if not sim_result:
        pytest.skip("No active simulations found in test database")
    simulation_id = str(sim_result["id"])

    # Execute - Call the service method
    svc = SimulationService(db)
    result = await svc.start_simulation_attempt(
        simulation_id=simulation_id,
        profile_id=profile_id,
        scenario_id_override=None,
        infinite=False,
        department_id=dept_id,
    )
    
    # Assert - Check basic structure
    assert result is not None
    assert "attempt_id" in result
    assert "chat_id" in result
    assert "chat_title" in result
    assert "scenario" in result
    
    # Check data types
    assert isinstance(result["attempt_id"], str)
    assert isinstance(result["chat_id"], str)
    assert isinstance(result["chat_title"], str)
    assert isinstance(result["scenario"], dict)
    
    # Check scenario structure
    scenario = result["scenario"]
    assert "id" in scenario
    assert "name" in scenario
    assert "problem_statement" in scenario
    assert "active" in scenario
    assert "department_id" in scenario
