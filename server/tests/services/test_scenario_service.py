"""Real database integration tests for ScenarioService."""

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,  # type: ignore
)

from app.schemas.scenarios import (
    GenerateScenarioAIRequest,  # type: ignore
    ScenarioDetailRequest,  # type: ignore
    ScenariosFilters,  # type: ignore
)
from app.services.scenario_service import ScenarioService  # type: ignore

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


async def test_scenarios_list_only_returns_root_scenarios(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that scenarios list only returns scenarios marked as roots in scenario_tree."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get count of root scenarios in database for this department
    root_count = await db.fetchval(
        """
        SELECT COUNT(DISTINCT st.parent_id)
        FROM scenario_tree st
        JOIN scenarios s ON s.id = st.parent_id
        WHERE st.parent_id = st.child_id
          AND s.department_id = $1
    """,
        dept_id,
    )

    # Execute service call
    svc = ScenarioService(db)
    resp = await svc.get_scenarios_list(
        ScenariosFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Assert - should return only root scenarios
    assert len(resp.scenarios) == root_count, (
        f"Expected {root_count} root scenarios, got {len(resp.scenarios)}"
    )

    # Verify each returned scenario is a root
    for scenario in resp.scenarios:
        is_root = await db.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM scenario_tree 
                WHERE parent_id = $1 AND child_id = $1
            )
        """,
            scenario.scenario_id,
        )

        assert is_root, (
            f"Scenario {scenario.scenario_id} should be marked as root in scenario_tree"
        )


async def test_scenario_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for scenarios."""
    dept_id = await get_cs_dept_id(db)
    superadmin_id = await get_superadmin_alias(db)

    # Get an admin profile (not superadmin)
    admin_id_result = await db.fetchval(
        """
        SELECT p.id FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        WHERE p.role = 'admin' AND pd.department_id = $1
        LIMIT 1
    """,
        dept_id,
    )

    if not admin_id_result:
        pytest.skip("No admin profile found for testing")

    admin_id = str(admin_id_result)

    # Execute as superadmin
    svc = ScenarioService(db)
    resp_superadmin = await svc.get_scenarios_list(
        ScenariosFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )

    # Execute as admin
    resp_admin = await svc.get_scenarios_list(
        ScenariosFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules (in order of precedence):
    # 1. Scenarios used in active simulations (num_simulations > 0): cannot edit (highest priority)
    # 2. Scenarios with default_scenario=true: only superadmin can edit (if not used)
    # 3. Other scenarios: admin and superadmin can edit

    for scenario_sa in resp_superadmin.scenarios:
        # Find same scenario in admin response
        scenario_admin = next(
            (
                s
                for s in resp_admin.scenarios
                if s.scenario_id == scenario_sa.scenario_id
            ),
            None,
        )

        if not scenario_admin:
            continue

        # Rule 1 (Highest priority): Scenarios used in active simulations - nobody can edit
        if scenario_sa.num_simulations > 0:
            assert scenario_sa.can_edit == False, (
                f"Scenario {scenario_sa.title} used in {scenario_sa.num_simulations} simulations should not be editable (superadmin)"
            )
            assert scenario_admin.can_edit == False, (
                f"Scenario {scenario_sa.title} used in {scenario_admin.num_simulations} simulations should not be editable (admin)"
            )

        # Rule 2: Unused default scenarios - only superadmin can edit
        elif scenario_sa.default_scenario and scenario_sa.num_simulations == 0:
            assert scenario_sa.can_edit == True, (
                f"Superadmin should be able to edit unused default scenario {scenario_sa.title}"
            )
            assert scenario_admin.can_edit == False, (
                f"Admin should NOT be able to edit default scenario {scenario_sa.title}"
            )

        # Rule 3: Unused, non-default scenarios - both can edit
        elif not scenario_sa.default_scenario and scenario_sa.num_simulations == 0:
            assert scenario_sa.can_edit == True, (
                f"Superadmin should be able to edit unused non-default scenario {scenario_sa.title}"
            )
            assert scenario_admin.can_edit == True, (
                f"Admin should be able to edit unused non-default scenario {scenario_sa.title}"
            )


async def test_scenario_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for scenarios."""
    dept_id = await get_cs_dept_id(db)
    superadmin_id = await get_superadmin_alias(db)

    # Get an admin profile (not superadmin)
    admin_id_result = await db.fetchval(
        """
        SELECT p.id FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        WHERE p.role = 'admin' AND pd.department_id = $1
        LIMIT 1
    """,
        dept_id,
    )

    if not admin_id_result:
        pytest.skip("No admin profile found for testing")

    admin_id = str(admin_id_result)

    # Execute as superadmin
    svc = ScenarioService(db)
    resp_superadmin = await svc.get_scenarios_list(
        ScenariosFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )

    # Execute as admin
    resp_admin = await svc.get_scenarios_list(
        ScenariosFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Scenarios with ANY links in simulation_scenarios (active or inactive): cannot delete
    # 2. Scenarios with default_scenario=true: only superadmin can delete (if no links)
    # 3. Other scenarios: admin and superadmin can delete (if no links)

    for scenario_sa in resp_superadmin.scenarios:
        # Get total links count from database
        total_links = await db.fetchval(
            """
            SELECT COUNT(*) FROM simulation_scenarios 
            WHERE scenario_id = $1
        """,
            scenario_sa.scenario_id,
        )

        # Find same scenario in admin response
        scenario_admin = next(
            (
                s
                for s in resp_admin.scenarios
                if s.scenario_id == scenario_sa.scenario_id
            ),
            None,
        )

        if not scenario_admin:
            continue

        # Rule 1: Scenarios with any simulation links - nobody can delete
        if total_links > 0:
            assert scenario_sa.can_delete == False, (
                f"Scenario {scenario_sa.title} with {total_links} simulation links should not be deletable (superadmin)"
            )
            assert scenario_admin.can_delete == False, (
                f"Scenario {scenario_sa.title} with {total_links} simulation links should not be deletable (admin)"
            )

        # Rule 2: Unlinked default scenarios - only superadmin can delete
        elif scenario_sa.default_scenario and total_links == 0:
            assert scenario_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked default scenario {scenario_sa.title}"
            )
            assert scenario_admin.can_delete == False, (
                f"Admin should NOT be able to delete default scenario {scenario_sa.title}"
            )

        # Rule 3: Unlinked, non-default scenarios - both can delete
        elif not scenario_sa.default_scenario and total_links == 0:
            assert scenario_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked non-default scenario {scenario_sa.title}"
            )
            assert scenario_admin.can_delete == True, (
                f"Admin should be able to delete unlinked non-default scenario {scenario_sa.title}"
            )


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
        assert len(resp.persona_mapping) > 0, (
            "persona_mapping should be populated when scenario has persona"
        )
        assert resp.persona_id in resp.persona_mapping, (
            f"Persona {resp.persona_id} should be in persona_mapping"
        )
        persona_item = resp.persona_mapping[resp.persona_id]
        assert hasattr(persona_item, "name") and len(persona_item.name) > 0, (
            "Persona mapping should have valid name"
        )
        assert hasattr(persona_item, "description"), (
            "Persona mapping should have description field"
        )

    # CRITICAL: Verify document_mapping is populated when document_ids exist
    if resp.document_ids and len(resp.document_ids) > 0:
        assert len(resp.document_mapping) > 0, (
            "document_mapping should be populated when scenario has documents"
        )
        first_doc_id = resp.document_ids[0]
        assert first_doc_id in resp.document_mapping, (
            f"Document {first_doc_id} should be in document_mapping"
        )
        doc_item = resp.document_mapping[first_doc_id]
        assert hasattr(doc_item, "name") and len(doc_item.name) > 0, (
            "Document mapping should have valid name"
        )
        assert hasattr(doc_item, "description"), (
            "Document mapping should have description field"
        )

    # CRITICAL: Verify parameter_item_mapping is populated when parameter_item_mapping has IDs
    # Note: ScenarioDetailResponse doesn't have parameter_item_ids field, check the mapping directly
    if hasattr(resp, "parameter_item_mapping") and len(resp.parameter_item_mapping) > 0:
        first_param_id = next(iter(resp.parameter_item_mapping.keys()))
        param_item = resp.parameter_item_mapping[first_param_id]
        assert hasattr(param_item, "name") and len(param_item.name) > 0, (
            "Parameter item mapping should have valid name"
        )


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


# ============================================================================
# GET SCENARIO DETAIL DEFAULT TESTS
# ============================================================================


async def test_get_scenario_detail_default(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default scenario detail for a profile."""
    admin_id = await get_superadmin_alias(db)

    svc = ScenarioService(db)
    from app.schemas.scenarios import ScenarioDetailDefaultRequest

    resp = await svc.get_scenario_detail_default(
        ScenarioDetailDefaultRequest(profileId=admin_id)
    )

    # Should return empty scenario structure with all valid options
    assert resp is not None
    assert resp.name == ""
    assert resp.problem_statement == ""
    assert resp.active is True
    assert resp.can_edit is True

    # CRITICAL: Verify department info is populated
    assert len(resp.valid_department_ids) > 0, (
        "valid_department_ids should be populated for superadmin"
    )
    assert resp.department_id is not None, (
        "department_id should be set to first valid department"
    )
    assert resp.department_id in resp.valid_department_ids, (
        "department_id should be in valid_department_ids"
    )

    # CRITICAL: Verify persona_mapping is populated when valid_persona_ids exist
    if len(resp.valid_persona_ids) > 0:
        assert len(resp.persona_mapping) > 0, (
            "persona_mapping should be populated when valid_persona_ids exist"
        )
        # Verify at least one persona is mapped correctly
        first_persona_id = resp.valid_persona_ids[0]
        assert first_persona_id in resp.persona_mapping, (
            f"Persona {first_persona_id} should be in persona_mapping"
        )
        persona_item = resp.persona_mapping[first_persona_id]
        assert hasattr(persona_item, "name") and len(persona_item.name) > 0, (
            "Persona mapping should have valid name"
        )
        assert hasattr(persona_item, "description"), (
            "Persona mapping should have description field"
        )
        assert hasattr(persona_item, "color") and len(persona_item.color) > 0, (
            "Persona mapping should have color"
        )
        assert hasattr(persona_item, "icon") and len(persona_item.icon) > 0, (
            "Persona mapping should have icon"
        )

    # CRITICAL: Verify document_mapping is populated when valid_document_ids exist
    if len(resp.valid_document_ids) > 0:
        assert len(resp.document_mapping) > 0, (
            "document_mapping should be populated when valid_document_ids exist"
        )
        # Verify at least one document is mapped correctly
        first_doc_id = resp.valid_document_ids[0]
        assert first_doc_id in resp.document_mapping, (
            f"Document {first_doc_id} should be in document_mapping"
        )
        doc_item = resp.document_mapping[first_doc_id]
        assert hasattr(doc_item, "name") and len(doc_item.name) > 0, (
            "Document mapping should have valid name"
        )
        assert hasattr(doc_item, "description"), (
            "Document mapping should have description field"
        )

    # CRITICAL: Verify parameter_mapping is populated
    if len(resp.parameter_mapping) > 0:
        first_param_id = next(iter(resp.parameter_mapping.keys()))
        param_item = resp.parameter_mapping[first_param_id]
        assert hasattr(param_item, "name") and len(param_item.name) > 0, (
            "Parameter mapping should have valid name"
        )
        assert hasattr(param_item, "description"), (
            "Parameter mapping should have description field"
        )

    # CRITICAL: Verify parameter_item_mapping is populated
    if len(resp.parameter_item_mapping) > 0:
        first_item_id = next(iter(resp.parameter_item_mapping.keys()))
        item = resp.parameter_item_mapping[first_item_id]
        assert hasattr(item, "name") and len(item.name) > 0, (
            "Parameter item mapping should have valid name"
        )
        assert hasattr(item, "description"), (
            "Parameter item mapping should have description field"
        )
        assert hasattr(item, "parameter_id") and len(item.parameter_id) > 0, (
            "Parameter item should have parameter_id"
        )
        assert hasattr(item, "parameter_name") and len(item.parameter_name) > 0, (
            "Parameter item should have parameter_name"
        )

    # CRITICAL: Verify department_mapping is populated when valid_department_ids exist
    if len(resp.valid_department_ids) > 0:
        assert len(resp.department_mapping) > 0, (
            "department_mapping should be populated when valid_department_ids exist"
        )
        # Verify at least one department is mapped correctly
        first_dept_id = resp.valid_department_ids[0]
        assert first_dept_id in resp.department_mapping, (
            f"Department {first_dept_id} should be in department_mapping"
        )
        dept_item = resp.department_mapping[first_dept_id]
        assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
            "Department mapping should have valid name"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping should have description field"
        )


async def test_get_scenario_detail_default_no_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default scenario detail for a profile with no departments."""
    # Create a profile with no department associations
    profile_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Test', 'User', 'testuser', 'guest') RETURNING id"
    )

    svc = ScenarioService(db)
    from app.schemas.scenarios import ScenarioDetailDefaultRequest

    with pytest.raises(ValueError, match="No accessible departments found for user"):
        await svc.get_scenario_detail_default(
            ScenarioDetailDefaultRequest(profileId=str(profile_id))
        )


# ============================================================================
# BUILD ENHANCED SCENARIO MAPPING TESTS (C1 CONSOLIDATION)
# ============================================================================


async def test_build_enhanced_scenario_mapping_consolidated_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test C1 consolidation: enhanced scenario mapping uses single consolidated query."""
    # Setup - Get test scenarios
    dept_id = await get_cs_dept_id(db)
    scenario_ids = await db.fetch(
        "SELECT id FROM scenarios WHERE department_id = $1 LIMIT 2", dept_id
    )

    if not scenario_ids:
        pytest.skip("No scenarios found in test database")

    scenario_id_list = [str(row["id"]) for row in scenario_ids]

    # Execute
    svc = ScenarioService(db)
    result = await svc.build_enhanced_scenario_mapping(scenario_id_list)

    # Assert - Check basic structure
    assert isinstance(result, dict)
    assert len(result) == len(scenario_id_list), (
        f"Expected {len(scenario_id_list)} scenarios in mapping, got {len(result)}"
    )

    # Verify each scenario has all required fields and nested mappings
    for scenario_id in scenario_id_list:
        assert scenario_id in result, f"Scenario {scenario_id} should be in mapping"

        mapping_item = result[scenario_id]
        # Check basic fields
        assert hasattr(mapping_item, "name")
        assert hasattr(mapping_item, "description")
        assert hasattr(mapping_item, "persona_id")

        # Check nested mappings exist
        assert hasattr(mapping_item, "persona_mapping")
        assert hasattr(mapping_item, "document_mapping")
        assert hasattr(mapping_item, "parameter_item_mapping")

        # Check ID lists
        assert hasattr(mapping_item, "parameter_item_ids")
        assert hasattr(mapping_item, "document_ids")
        assert isinstance(mapping_item.parameter_item_ids, list)
        assert isinstance(mapping_item.document_ids, list)

        # Verify persona mapping consistency
        if mapping_item.persona_id:
            assert len(mapping_item.persona_mapping) > 0, (
                f"Scenario {scenario_id} with persona should have persona_mapping populated"
            )
            assert mapping_item.persona_id in mapping_item.persona_mapping, (
                f"Persona {mapping_item.persona_id} should be in persona_mapping"
            )
            persona_item = mapping_item.persona_mapping[mapping_item.persona_id]
            assert hasattr(persona_item, "name") and len(persona_item.name) > 0
            assert hasattr(persona_item, "color")
            assert hasattr(persona_item, "icon")

        # Verify document mapping consistency
        if len(mapping_item.document_ids) > 0:
            assert len(mapping_item.document_mapping) > 0, (
                f"Scenario {scenario_id} with documents should have document_mapping populated"
            )
            for doc_id in mapping_item.document_ids:
                assert doc_id in mapping_item.document_mapping, (
                    f"Document {doc_id} should be in document_mapping"
                )
                doc_item = mapping_item.document_mapping[doc_id]
                assert hasattr(doc_item, "name") and len(doc_item.name) > 0
                assert hasattr(doc_item, "description")

        # Verify parameter_item mapping consistency
        if len(mapping_item.parameter_item_ids) > 0:
            assert len(mapping_item.parameter_item_mapping) > 0, (
                f"Scenario {scenario_id} with parameter items should have parameter_item_mapping populated"
            )
            for param_item_id in mapping_item.parameter_item_ids:
                assert param_item_id in mapping_item.parameter_item_mapping, (
                    f"Parameter item {param_item_id} should be in parameter_item_mapping"
                )
                param_item = mapping_item.parameter_item_mapping[param_item_id]
                assert hasattr(param_item, "name") and len(param_item.name) > 0
                assert hasattr(param_item, "parameter_id")
                assert hasattr(param_item, "parameter_name")


async def test_build_enhanced_scenario_mapping_empty_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test enhanced scenario mapping with empty list returns empty dict."""
    svc = ScenarioService(db)
    result = await svc.build_enhanced_scenario_mapping([])

    assert isinstance(result, dict)
    assert len(result) == 0, "Empty scenario_ids should return empty mapping"


# ============================================================================
# AI GENERATION TESTS
# ============================================================================


async def test_generate_scenario_ai_request_accepts_user_instructions(
    db: asyncpg.Connection,
) -> None:
    """Test that GenerateScenarioAIRequest accepts userInstructions parameter."""
    dept_id = await get_cs_dept_id(db)
    
    # Test request creation with userInstructions
    request = GenerateScenarioAIRequest(
        departmentId=dept_id,
        userInstructions="Make the scenario more challenging",
    )
    
    assert request.userInstructions == "Make the scenario more challenging"
    assert request.departmentId == dept_id


async def test_generate_scenario_ai_request_user_instructions_optional(
    db: asyncpg.Connection,
) -> None:
    """Test that userInstructions is optional in GenerateScenarioAIRequest."""
    dept_id = await get_cs_dept_id(db)
    
    # Test request creation without userInstructions
    request = GenerateScenarioAIRequest(
        departmentId=dept_id,
    )
    
    assert request.userInstructions is None
    assert request.departmentId == dept_id
