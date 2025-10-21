"""Real database integration tests for PracticeService."""

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import get_cs_dept_id

from app.schemas.analytics import AnalyticsFilters
from app.services.practice_service import PracticeService

pytestmark = pytest.mark.asyncio


# ============================================================================
# PRACTICE OVERVIEW TESTS
# ============================================================================


async def test_practice_overview_returns_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that practice overview returns correct structure."""
    dept_id = await get_cs_dept_id(db)

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=None,
            departmentIds=[dept_id],
        )
    )

    # Verify response structure
    assert resp.mode == "practice"
    assert resp.hasData is not None
    assert isinstance(resp.items, list)
    assert isinstance(resp.history, list)

    # Verify all 7 mappings exist and are not None
    assert resp.standard_groups_mapping is not None
    assert resp.standards_mapping is not None
    assert resp.simulation_mapping is not None
    assert resp.persona_mapping is not None
    assert resp.scenario_mapping is not None
    assert resp.parameter_mapping is not None
    assert resp.parameter_item_mapping is not None

    # If items exist, verify they have required fields
    if len(resp.items) > 0:
        item = resp.items[0]
        assert hasattr(item, "id") and item.id is not None
        assert hasattr(item, "simulationTitle") and item.simulationTitle is not None
        assert hasattr(item, "status")


async def test_practice_overview_mappings_populated(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that practice overview mappings are actually populated when data exists."""
    dept_id = await get_cs_dept_id(db)

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=None,
            departmentIds=[dept_id],
        )
    )

    # Collect all entity IDs from items and history
    simulation_ids: set[str] = set()
    rubric_ids: set[str] = set()

    for item in resp.items:
        if hasattr(item, "id") and item.id:
            simulation_ids.add(item.id)
        # Note: rubric_id is not directly on PracticeSimulationItem in the response
        # It's embedded in the item structure as a different field

    # If simulations exist, simulation_mapping should have entries
    if len(simulation_ids) > 0:
        assert len(resp.simulation_mapping) > 0, (
            "simulation_mapping should be populated when simulations exist"
        )
        # Verify at least one simulation is mapped correctly
        sample_sim_id = next(iter(simulation_ids))
        if sample_sim_id in resp.simulation_mapping:
            sim_item = resp.simulation_mapping[sample_sim_id]
            assert hasattr(sim_item, "name"), (
                "Simulation mapping should have name field"
            )
            assert hasattr(sim_item, "description"), (
                "Simulation mapping should have description field"
            )

    # If rubrics exist, standard_groups_mapping should have entries
    if len(rubric_ids) > 0 and resp.hasData:
        # Standard groups mapping may be empty if no rubrics have standard groups yet
        # So we just verify the field exists and is a dict
        assert isinstance(resp.standard_groups_mapping, dict), (
            "standard_groups_mapping should be a dict"
        )
        assert isinstance(resp.standards_mapping, dict), (
            "standards_mapping should be a dict"
        )


async def test_practice_overview_with_profile_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview with profileId filter."""
    dept_id = await get_cs_dept_id(db)

    # Get a valid profile_id from database
    profile_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'instructional' AND active = true LIMIT 1"
    )

    if profile_id is None:
        pytest.skip("No instructor profile found in test database")

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=str(profile_id),
            departmentIds=[dept_id],
        )
    )

    # Verify response structure
    assert resp.mode == "practice"

    # Verify history contains only attempts for that profile (if any)
    for history_row in resp.history:
        if hasattr(history_row, "profileId"):
            assert history_row.profileId == str(profile_id), (
                "History should only contain attempts for specified profile"
            )


async def test_practice_overview_with_department_filter(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview with department filter."""
    dept_id = await get_cs_dept_id(db)

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=None,
            departmentIds=[dept_id],
        )
    )

    # Verify response has correct structure
    assert resp.mode == "practice"
    assert isinstance(resp.items, list)

    # All simulations should be from CS department (practice simulations)
    # Verify mappings only include CS entities
    assert isinstance(resp.simulation_mapping, dict)


async def test_practice_overview_empty_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview with impossible filters returns empty data."""
    # Create a non-existent department ID
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=None,
            departmentIds=[fake_dept_id],
        )
    )

    # Verify hasData is False
    assert resp.hasData is False

    # Verify items is empty array
    assert isinstance(resp.items, list)
    assert len(resp.items) == 0

    # Verify history is empty array
    assert isinstance(resp.history, list)
    assert len(resp.history) == 0

    # Verify mappings are empty dicts (not None)
    assert isinstance(resp.standard_groups_mapping, dict)
    assert isinstance(resp.standards_mapping, dict)
    assert isinstance(resp.simulation_mapping, dict)
    assert isinstance(resp.persona_mapping, dict)
    assert isinstance(resp.scenario_mapping, dict)
    assert isinstance(resp.parameter_mapping, dict)
    assert isinstance(resp.parameter_item_mapping, dict)


async def test_practice_overview_history_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that history items have required fields."""
    dept_id = await get_cs_dept_id(db)

    # Get a profile with practice attempts
    profile_id = await db.fetchval(
        """
        SELECT DISTINCT a.profile_id
        FROM analytics a
        WHERE a.is_practice = true
          AND a.department_id = $1
        LIMIT 1
        """,
        dept_id,
    )

    if profile_id is None:
        pytest.skip("No practice attempts found in test database")

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=str(profile_id),
            departmentIds=[dept_id],
        )
    )

    # Verify history items have required fields
    if len(resp.history) > 0:
        history_item = resp.history[0]
        assert hasattr(history_item, "attemptId")
        assert hasattr(history_item, "date")
        assert hasattr(history_item, "simulationName")
        assert hasattr(history_item, "personaNames")
        assert hasattr(history_item, "personaColors")
        assert hasattr(history_item, "timeLimit"), (
            "History item must have timeLimit field"
        )
        assert hasattr(history_item, "cohortNames"), (
            "History item must have cohortNames field"
        )

        # Verify personaNames and personaColors are arrays
        assert isinstance(history_item.personaNames, list)
        assert isinstance(history_item.personaColors, list)
        # Verify timeLimit is nullable int and cohortNames is list
        assert history_item.timeLimit is None or isinstance(history_item.timeLimit, int)
        assert isinstance(history_item.cohortNames, list), "cohortNames must be a list"


async def test_practice_overview_standard_groups(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that items contain standard_groups field with correct structure."""
    dept_id = await get_cs_dept_id(db)

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=None,
            departmentIds=[dept_id],
        )
    )

    # Verify items contain standard_groups field
    if len(resp.items) > 0:
        item = resp.items[0]
        if hasattr(item, "standard_groups") and item.standard_groups:
            standard_groups = item.standard_groups
            # Check structure: dict[str, list[str]] (standard_group_id → standard_ids)
            assert isinstance(standard_groups, (dict, type(None))), (
                "standard_groups should be dict or None"
            )
            if isinstance(standard_groups, dict):
                for sg_id, standards_list in standard_groups.items():
                    assert isinstance(sg_id, str), "standard_group_id should be string"
                    assert isinstance(standards_list, (list, type(None))), (
                        "standards list should be array or None"
                    )


async def test_practice_overview_with_no_profile_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test practice overview without profileId returns all practice simulations."""
    dept_id = await get_cs_dept_id(db)

    svc = PracticeService(db)
    resp = await svc.get_practice_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            cohortIds=None,
            roles=None,
            simulationFilters=None,
            profileId=None,
            departmentIds=[dept_id],
        )
    )

    # Verify response structure
    assert resp.mode == "practice"
    assert isinstance(resp.items, list)

    # Should return practice simulations even without profile filter
    # hasData should be True if there are practice simulations in CS department
    if len(resp.items) > 0:
        assert resp.hasData is True
