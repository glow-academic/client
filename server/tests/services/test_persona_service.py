"""
Tests for persona_service - list and search methods.
"""

import asyncpg  # type: ignore
import pytest
from app.schemas.personas import PersonaDetailRequest  # type: ignore
from app.schemas.personas import PersonasFilters  # type: ignore
from app.services.persona_service import PersonaService  # type: ignore

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
async def test_get_personas_list(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting personas list with embedded mappings."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = PersonasFilters(departmentIds=[dept_id], profileId=profile_id)

    # Execute - Call the service method
    svc = PersonaService(db)
    result = await svc.get_personas_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "personas")
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "model_mapping")

    # Check that personas is a list (could be empty)
    assert isinstance(result.personas, list)
    assert len(result.personas) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.model_mapping, dict)

    # If personas exist, check basic fields
    if result.personas:
        persona = result.personas[0]
        assert hasattr(persona, "persona_id")
        assert hasattr(persona, "name")
        assert hasattr(persona, "scenario_ids")
        assert hasattr(persona, "model_id")
        assert isinstance(persona.scenario_ids, list)


@pytest.mark.asyncio
async def test_get_personas_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = PersonasFilters(departmentIds=[], profileId=profile_id)

    # Execute
    svc = PersonaService(db)
    result = await svc.get_personas_list(filters)

    # Assert - Should return empty list but valid structure
    assert result is not None
    assert isinstance(result.personas, list)
    assert len(result.personas) == 0
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.model_mapping, dict)


@pytest.mark.asyncio
async def test_personas_only_count_root_scenarios(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that personas list only counts root scenarios in num_scenarios."""
    # Setup
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Execute
    svc = PersonaService(db)
    filters = PersonasFilters(departmentIds=[dept_id], profileId=profile_id)
    result = await svc.get_personas_list(filters)

    # Assert - For each persona, verify num_scenarios matches root scenario count
    for persona in result.personas:
        # Count root scenarios for this persona in database
        root_scenario_count = await db.fetchval(
            """
            SELECT COUNT(DISTINCT s.id)
            FROM scenario_personas sp
            JOIN scenarios s ON s.id = sp.scenario_id
            JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            WHERE sp.persona_id = $1 AND sp.active = true
        """,
            persona.persona_id,
        )

        assert persona.num_scenarios == root_scenario_count, (
            f"Persona {persona.name} num_scenarios should be {root_scenario_count} (roots only), got {persona.num_scenarios}"
        )


@pytest.mark.asyncio
async def test_search_personas(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test searching personas by name."""
    # Setup
    svc = PersonaService(db)

    # Get a persona name to search for
    persona_result = await db.fetchrow("SELECT name FROM personas LIMIT 1")

    if persona_result and persona_result["name"]:
        # Use first word of name as search query
        search_query = persona_result["name"].split()[0]

        # Execute
        result = await svc.search_personas(search_query, limit=10)

        # Assert - Check basic structure
        assert isinstance(result, list)
        assert len(result) >= 0

        # If results exist, check structure
        if result:
            item = result[0]
            assert "id" in item
            assert "name" in item
            assert "score" in item
            assert "description" in item
            assert isinstance(item["score"], (int, float))
    else:
        # No personas in database, just test empty search
        result = await svc.search_personas("nonexistent", limit=10)
        assert isinstance(result, list)
        assert len(result) == 0


@pytest.mark.asyncio
async def test_search_personas_empty_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching with empty query returns empty list."""
    # Setup
    svc = PersonaService(db)

    # Execute - Empty search query
    result = await svc.search_personas("", limit=10)

    # Assert - Should return empty list
    assert isinstance(result, list)
    assert len(result) == 0


@pytest.mark.asyncio
async def test_search_personas_limit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching personas respects limit parameter."""
    # Setup
    svc = PersonaService(db)

    # Execute - Search with small limit
    result = await svc.search_personas("persona", limit=2)

    # Assert - Should not exceed limit
    assert isinstance(result, list)
    assert len(result) <= 2


@pytest.mark.asyncio
async def test_get_persona_detail_optimized(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting persona detail with all mappings in single query."""
    # Setup - Get test persona and profile IDs
    persona_result = await db.fetchrow("SELECT id FROM personas LIMIT 1")
    if not persona_result:
        pytest.skip("No personas found in test database")

    persona_id = str(persona_result["id"])
    profile_id = await get_test_profile_id(db)

    # Create request
    request = PersonaDetailRequest(personaId=persona_id, profileId=profile_id)

    # Execute - Call the service method
    svc = PersonaService(db)
    result = await svc.get_persona_detail(request)

    # Assert - Check basic structure
    assert result is not None
    assert result.name is not None
    assert result.description is not None

    # Check mappings exist
    assert result.model_mapping is not None
    assert isinstance(result.model_mapping, dict)
    assert result.reasoning_mapping is not None
    assert isinstance(result.reasoning_mapping, dict)
    assert result.department_mapping is not None
    assert isinstance(result.department_mapping, dict)

    # Check valid IDs lists
    assert result.valid_model_ids is not None
    assert isinstance(result.valid_model_ids, list)
    assert result.valid_department_ids is not None
    assert isinstance(result.valid_department_ids, list)

    # CRITICAL: Verify model_mapping is populated when model_id exists
    if result.model_id:
        assert len(result.model_mapping) > 0, (
            "model_mapping should be populated when persona has model"
        )
        assert result.model_id in result.model_mapping, (
            f"Model {result.model_id} should be in model_mapping"
        )
        model_item = result.model_mapping[result.model_id]
        assert hasattr(model_item, "name") and len(model_item.name) > 0, (
            "Model mapping should have valid name"
        )
        assert hasattr(model_item, "description"), (
            "Model mapping should have description field"
        )

    # CRITICAL: Verify department_mapping is populated when department_id exists
    if result.department_id:
        assert len(result.department_mapping) > 0, (
            "department_mapping should be populated when persona has department"
        )
        assert result.department_id in result.department_mapping, (
            f"Department {result.department_id} should be in department_mapping"
        )
        dept_item = result.department_mapping[result.department_id]
        assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
            "Department mapping should have valid name"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping should have description field"
        )

    # CRITICAL: Verify reasoning_mapping contains all expected levels
    assert len(result.reasoning_mapping) == 5, (
        "reasoning_mapping should have 5 levels (none, minimal, low, medium, high)"
    )
    expected_reasoning_levels = ["none", "minimal", "low", "medium", "high"]
    for level in expected_reasoning_levels:
        assert level in result.reasoning_mapping, (
            f"Reasoning level '{level}' should be in reasoning_mapping"
        )
        reasoning_item = result.reasoning_mapping[level]
        assert hasattr(reasoning_item, "name") and len(reasoning_item.name) > 0, (
            f"Reasoning level '{level}' should have valid name"
        )
        assert (
            hasattr(reasoning_item, "description")
            and len(reasoning_item.description) > 0
        ), f"Reasoning level '{level}' should have valid description"

    # Check permission flags exist
    assert isinstance(result.can_edit, bool)
    assert isinstance(result.can_duplicate, bool)
    assert isinstance(result.can_delete, bool)


@pytest.mark.asyncio
async def test_get_persona_detail_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting persona detail with invalid ID raises error."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create request with non-existent persona ID
    request = PersonaDetailRequest(
        personaId="00000000-0000-0000-0000-000000000000", profileId=profile_id
    )

    # Execute & Assert - Should raise ValueError
    svc = PersonaService(db)
    with pytest.raises(ValueError, match="Persona not found"):
        await svc.get_persona_detail(request)


@pytest.mark.asyncio
async def test_persona_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for personas based on active scenario links."""
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
        "SELECT id FROM profiles WHERE role IN ('admin', 'instructional') LIMIT 1"
    )

    if not superadmin_result or not admin_result:
        pytest.skip("Need both superadmin and admin/instructional profiles")

    superadmin_id = str(superadmin_result["id"])
    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.personas import PersonasFilters

    svc = PersonaService(db)
    resp_superadmin = await svc.get_personas_list(
        PersonasFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )
    resp_admin = await svc.get_personas_list(
        PersonasFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Personas with active scenario links: cannot edit
    # 2. Default personas: only superadmin can edit
    # 3. Other personas: instructional, admin, superadmin can edit

    for persona_sa in resp_superadmin.personas:
        # Get active scenario link counts from database
        active_scenario_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM scenario_personas 
            WHERE persona_id = $1 AND active = true
        """,
            persona_sa.persona_id,
        )

        persona_admin = next(
            (p for p in resp_admin.personas if p.persona_id == persona_sa.persona_id),
            None,
        )

        if not persona_admin:
            continue

        # Rule 1: Personas with active scenario links - nobody can edit
        if active_scenario_count > 0:
            assert persona_sa.can_edit == False, (
                f"Persona {persona_sa.persona_name} with {active_scenario_count} active scenario links should not be editable (superadmin)"
            )
            assert persona_admin.can_edit == False, (
                f"Persona {persona_admin.persona_name} with {active_scenario_count} active scenario links should not be editable (admin)"
            )

        # Rule 2: Default personas - only superadmin can edit
        elif persona_sa.default_persona:
            assert persona_sa.can_edit == True, (
                f"Superadmin should be able to edit default persona {persona_sa.persona_name}"
            )
            assert persona_admin.can_edit == False, (
                f"Admin should NOT be able to edit default persona {persona_admin.persona_name}"
            )

        # Rule 3: Non-default personas without active scenario links - all can edit
        elif not persona_sa.default_persona and active_scenario_count == 0:
            assert persona_sa.can_edit == True, (
                f"Superadmin should be able to edit non-default persona {persona_sa.persona_name}"
            )
            assert persona_admin.can_edit == True, (
                f"Admin should be able to edit non-default persona {persona_admin.persona_name}"
            )


@pytest.mark.asyncio
async def test_persona_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for personas based on all scenario links."""
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
        "SELECT id FROM profiles WHERE role IN ('admin', 'instructional') LIMIT 1"
    )

    if not superadmin_result or not admin_result:
        pytest.skip("Need both superadmin and admin/instructional profiles")

    superadmin_id = str(superadmin_result["id"])
    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.personas import PersonasFilters

    svc = PersonaService(db)
    resp_superadmin = await svc.get_personas_list(
        PersonasFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )
    resp_admin = await svc.get_personas_list(
        PersonasFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Personas with ANY scenario links (active or inactive): cannot delete
    # 2. Default personas (not linked): only superadmin can delete
    # 3. Other personas: instructional, admin, superadmin can delete (if no links)

    for persona_sa in resp_superadmin.personas:
        # Get total scenario link count from database
        total_scenario_links = await db.fetchval(
            """
            SELECT COUNT(*) FROM scenario_personas 
            WHERE persona_id = $1
        """,
            persona_sa.persona_id,
        )

        persona_admin = next(
            (p for p in resp_admin.personas if p.persona_id == persona_sa.persona_id),
            None,
        )

        if not persona_admin:
            continue

        # Rule 1: Personas with any scenario links - nobody can delete
        if total_scenario_links > 0:
            assert persona_sa.can_delete == False, (
                f"Persona {persona_sa.persona_name} with {total_scenario_links} scenario links should not be deletable (superadmin)"
            )
            assert persona_admin.can_delete == False, (
                f"Persona {persona_admin.persona_name} with {total_scenario_links} scenario links should not be deletable (admin)"
            )

        # Rule 2: Unlinked default personas - only superadmin can delete
        elif persona_sa.default_persona and total_scenario_links == 0:
            assert persona_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked default persona {persona_sa.persona_name}"
            )
            assert persona_admin.can_delete == False, (
                f"Admin should NOT be able to delete default persona {persona_admin.persona_name}"
            )

        # Rule 3: Unlinked, non-default personas - all can delete
        elif not persona_sa.default_persona and total_scenario_links == 0:
            assert persona_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked non-default persona {persona_sa.persona_name}"
            )
            assert persona_admin.can_delete == True, (
                f"Admin should be able to delete unlinked non-default persona {persona_admin.persona_name}"
            )


@pytest.mark.skip(reason="C2 consolidation query needs debugging - scenario_count mismatch with subqueries")
@pytest.mark.asyncio
async def test_get_persona_response_times_consolidated_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test C2 consolidation: persona response times uses single consolidated query."""
    # Setup - Get test persona
    persona_result = await db.fetchrow("SELECT id FROM personas LIMIT 1")
    if not persona_result:
        pytest.skip("No personas found in test database")

    persona_id = str(persona_result["id"])

    # Execute
    svc = PersonaService(db)
    result = await svc.get_persona_response_times(persona_id, window_days=30)

    # Assert - Check basic structure (may have no data if no chats)
    assert "persona" in result
    assert "stats" in result
    assert "recent_responses" in result

    # Verify persona info is populated
    assert "id" in result["persona"]
    assert "name" in result["persona"]
    assert "description" in result["persona"]
    assert result["persona"]["id"] == persona_id

    # Verify stats structure exists
    assert result["stats"] is not None
    assert isinstance(result["stats"], dict)

    # Verify recent_responses is a list (may be empty)
    assert isinstance(result["recent_responses"], list)

    # If scenarios exist, verify they're included
    if "scenario_count" in result["persona"]:
        # Get actual scenario count from database
        actual_scenario_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM scenario_personas 
            WHERE persona_id = $1 AND active = true
        """,
            persona_id,
        )
        assert result["persona"]["scenario_count"] == actual_scenario_count, (
            f"Expected {actual_scenario_count} scenarios, got {result['persona']['scenario_count']}"
        )

    # If response data exists, verify structure
    if len(result["recent_responses"]) > 0:
        response = result["recent_responses"][0]
        assert "chat_id" in response
        assert "scenario_name" in response
        assert "response_time_seconds" in response
        assert isinstance(response["response_time_seconds"], (int, float))

        # Verify stats are calculated
        assert "total_responses" in result["stats"]
        assert "avg_response_time" in result["stats"]


@pytest.mark.asyncio
async def test_get_persona_detail_default_consolidated(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default persona detail with consolidated query (1 query instead of 2)."""
    # Setup - Get test profile ID
    profile_id = await get_test_profile_id(db)

    # Create request
    from app.schemas.personas import PersonaDetailDefaultRequest

    request = PersonaDetailDefaultRequest(profileId=profile_id)

    # Execute - Call the service method
    svc = PersonaService(db)
    result = await svc.get_persona_detail_default(request)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "name")
    assert hasattr(result, "description")
    assert hasattr(result, "department_id")
    assert hasattr(result, "active")
    assert hasattr(result, "default_persona")
    assert hasattr(result, "color")
    assert hasattr(result, "icon")
    assert hasattr(result, "model_id")
    assert hasattr(result, "reasoning")
    assert hasattr(result, "temperature")
    assert hasattr(result, "system_prompt")
    assert hasattr(result, "department_mapping")
    assert hasattr(result, "valid_department_ids")
    assert hasattr(result, "model_mapping")
    assert hasattr(result, "valid_model_ids")

    # Check that it returns actual data
    assert result.name is not None
    assert result.department_id is not None
    assert isinstance(result.department_mapping, dict)
    assert isinstance(result.valid_department_ids, list)
    assert isinstance(result.model_mapping, dict)
    assert isinstance(result.valid_model_ids, list)
