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
    
    # CRITICAL: Verify persona_mapping is populated when persona_id exists
    if resp.persona_id:
        assert len(resp.persona_mapping) > 0, "persona_mapping should be populated when scenario has persona"
        assert resp.persona_id in resp.persona_mapping, f"Persona {resp.persona_id} should be in persona_mapping"
        persona_item = resp.persona_mapping[resp.persona_id]
        assert hasattr(persona_item, 'name') and len(persona_item.name) > 0, "Persona mapping should have valid name"
        assert hasattr(persona_item, 'description'), "Persona mapping should have description field"
    
    # CRITICAL: Verify document_mapping is populated when document_ids exist
    if resp.document_ids and len(resp.document_ids) > 0:
        assert len(resp.document_mapping) > 0, "document_mapping should be populated when scenario has documents"
        first_doc_id = resp.document_ids[0]
        assert first_doc_id in resp.document_mapping, f"Document {first_doc_id} should be in document_mapping"
        doc_item = resp.document_mapping[first_doc_id]
        assert hasattr(doc_item, 'name') and len(doc_item.name) > 0, "Document mapping should have valid name"
        assert hasattr(doc_item, 'description'), "Document mapping should have description field"
    
    # CRITICAL: Verify parameter_item_mapping is populated when parameter_item_mapping has IDs
    # Note: ScenarioDetailResponse doesn't have parameter_item_ids field, check the mapping directly
    if hasattr(resp, 'parameter_item_mapping') and len(resp.parameter_item_mapping) > 0:
        first_param_id = next(iter(resp.parameter_item_mapping.keys()))
        param_item = resp.parameter_item_mapping[first_param_id]
        assert hasattr(param_item, 'name') and len(param_item.name) > 0, "Parameter item mapping should have valid name"


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
