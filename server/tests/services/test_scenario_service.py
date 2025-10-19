"""Real database integration tests for ScenarioService."""

import asyncpg  # type: ignore
import pytest
from app.schemas.scenarios import ScenarioDetailRequest  # type: ignore
from app.schemas.scenarios import ScenariosFilters  # type: ignore
from app.services.scenario_service import ScenarioService  # type: ignore
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# LIST SCENARIOS TESTS
# ============================================================================


async def test_get_scenarios_list_returns_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test scenarios list returns CS department scenarios."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = ScenarioService(db)
    resp = await svc.get_scenarios_list(
        ScenariosFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    assert resp.scenarios is not None
    assert resp.objective_mapping is not None
    assert resp.persona_mapping is not None


# ============================================================================
# GET SCENARIO DETAIL TESTS
# ============================================================================


async def test_get_scenario_detail_needs_scenario_in_seed(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenario detail (skip if no scenarios)."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get first scenario if exists
    scenario_id = await db.fetchval(
        "SELECT id FROM scenarios WHERE department_id = $1 LIMIT 1", dept_id
    )

    if not scenario_id:
        pytest.skip("No scenarios in seed data")

    svc = ScenarioService(db)
    resp = await svc.get_scenario_detail(
        ScenarioDetailRequest(scenarioId=str(scenario_id), profileId=admin_id)
    )

    assert resp.name is not None
    assert resp.persona_mapping is not None
    assert resp.document_mapping is not None
    assert resp.parameter_mapping is not None


async def test_get_scenario_detail_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting scenario detail with invalid ID."""
    admin_id = await get_superadmin_alias(db)
    fake_id = "00000000-0000-0000-0000-000000000000"

    svc = ScenarioService(db)
    with pytest.raises(ValueError, match="Scenario.*not found"):
        await svc.get_scenario_detail(
            ScenarioDetailRequest(scenarioId=fake_id, profileId=admin_id)
        )
