"""
Tests for persona_service - list and search methods.
"""

import asyncpg
import pytest

from app.schemas.personas import PersonasFilters
from app.services.persona_service import PersonaService

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
async def test_get_personas_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list with embedded mappings."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = PersonasFilters(
        departmentIds=[dept_id],
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = PersonaService(db)
    result = await svc.get_personas_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, 'personas')
    assert hasattr(result, 'scenario_mapping')
    assert hasattr(result, 'model_mapping')

    # Check that personas is a list (could be empty)
    assert isinstance(result.personas, list)
    assert len(result.personas) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.model_mapping, dict)

    # If personas exist, check basic fields
    if result.personas:
        persona = result.personas[0]
        assert hasattr(persona, 'persona_id')
        assert hasattr(persona, 'name')
        assert hasattr(persona, 'scenario_ids')
        assert hasattr(persona, 'model_id')
        assert isinstance(persona.scenario_ids, list)


@pytest.mark.asyncio
async def test_get_personas_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = PersonasFilters(
        departmentIds=[],
        profileId=profile_id
    )

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
async def test_search_personas(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching personas by name."""
    # Setup
    svc = PersonaService(db)

    # Get a persona name to search for
    persona_result = await db.fetchrow("SELECT name FROM personas LIMIT 1")

    if persona_result and persona_result['name']:
        # Use first word of name as search query
        search_query = persona_result['name'].split()[0]

        # Execute
        result = await svc.search_personas(search_query, limit=10)

        # Assert - Check basic structure
        assert isinstance(result, list)
        assert len(result) >= 0

        # If results exist, check structure
        if result:
            item = result[0]
            assert 'id' in item
            assert 'name' in item
            assert 'score' in item
            assert 'description' in item
            assert isinstance(item['score'], (int, float))
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
