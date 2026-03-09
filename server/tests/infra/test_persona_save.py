"""Integration tests for persona_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.persona_save import resolve_persona_values, save_persona_client
from app.routes.v5.api.main.persona.types import SavePersonaItem

from .conftest import (
    ADMIN_PROFILE_ID,
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_color_id(pool, redis_client) -> UUID:
    """Fetch a real color_id from seeded data."""
    from app.routes.v5.tools.resources.colors.search import search_colors

    async with pool.acquire() as conn:
        results = await search_colors(
            conn, redis_client, search=None, limit_count=1, persona=True
        )
    assert results, "No persona colors in seed data"
    return results[0].id


async def _get_icon_id(pool, redis_client) -> UUID:
    """Fetch a real icon_id from seeded data."""
    from app.routes.v5.tools.resources.icons.search import search_icons

    async with pool.acquire() as conn:
        results = await search_icons(
            conn, redis_client, search=None, limit_count=1, persona=True
        )
    assert results, "No persona icons in seed data"
    return results[0].id


async def _create_instruction_id(pool, redis_client) -> UUID:
    """Create an instruction resource."""
    from app.routes.v5.tools.resources.instructions.create import create_instruction

    async with pool.acquire() as conn:
        result = await create_instruction(conn, "Test instruction template", redis_client)
    return result.id


# ---------------------------------------------------------------------------
# resolve_persona_values
# ---------------------------------------------------------------------------


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Persona", redis_client)

        item = SavePersonaItem(
            name_id=name.id,
            color_id=color_id,
            icon_id=icon_id,
            instructions_id=instr_id,
        )

        errors = await resolve_persona_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        item = SavePersonaItem(
            name="Brand New Persona",
            color_id=color_id,
            icon_id=icon_id,
            instructions_id=instr_id,
        )

        errors = await resolve_persona_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        item = SavePersonaItem(
            name_id=name_id,
            color_id=color_id,
            icon_id=icon_id,
            instructions_id=instr_id,
            description="A useful persona",
        )

        errors = await resolve_persona_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SavePersonaItem()

        errors = await resolve_persona_values(pool, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names
        assert "color" in field_names
        assert "icon" in field_names
        assert "instructions" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SavePersonaItem()

        errors = await resolve_persona_values(pool, redis_client, item, is_update=True)

        assert errors == []

    async def test_creates_examples_from_values(self, pool, redis_client, name_id):
        """Raw examples -> create_example per item."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        item = SavePersonaItem(
            name_id=name_id,
            color_id=color_id,
            icon_id=icon_id,
            instructions_id=instr_id,
            examples=["Hello", "Goodbye"],
        )

        errors = await resolve_persona_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.example_ids is not None
        assert len(item.example_ids) == 2


# ---------------------------------------------------------------------------
# save_persona_client -- create
# ---------------------------------------------------------------------------


class TestSavePersonaClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a persona with pre-resolved IDs."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        result = await save_persona_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SavePersonaItem(
                    name_id=name_id,
                    color_id=color_id,
                    icon_id=icon_id,
                    instructions_id=instr_id,
                )
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].persona_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a persona with raw name (auto-resolved)."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        result = await save_persona_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SavePersonaItem(
                    name="My New Persona",
                    color_id=color_id,
                    icon_id=icon_id,
                    instructions_id=instr_id,
                )
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Guest cannot create personas."""
        with pytest.raises(HTTPException) as exc_info:
            await save_persona_client(
                pool,
                redis_client,
                profile_id=GUEST_PROFILE_ID,
                items=[SavePersonaItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# save_persona_client -- update
# ---------------------------------------------------------------------------


class TestSavePersonaClientUpdate:
    async def _create_persona(self, pool, redis_client) -> UUID:
        """Helper: create a persona to update later."""
        color_id = await _get_color_id(pool, redis_client)
        icon_id = await _get_icon_id(pool, redis_client)
        instr_id = await _create_instruction_id(pool, redis_client)

        result = await save_persona_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SavePersonaItem(
                    name="Persona To Update",
                    color_id=color_id,
                    icon_id=icon_id,
                    instructions_id=instr_id,
                )
            ],
        )
        return result.results[0].persona_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing persona's name."""
        persona_id = await self._create_persona(pool, redis_client)

        result = await save_persona_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SavePersonaItem(input_persona_id=persona_id, name="Updated Name")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].persona_id == persona_id
        assert result.results[0].message == "Persona updated successfully"

    async def test_update_persona_not_found(self, pool, redis_client):
        """Update with non-existent persona -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_persona_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SavePersonaItem(input_persona_id=fake_id)],
            )

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# save_persona_client -- validation
# ---------------------------------------------------------------------------


class TestSavePersonaClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SavePersonaItem()  # Missing required fields

        result = await save_persona_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[item],
        )

        assert len(result.results) == 1
        assert result.results[0].success is False
        assert result.results[0].errors is not None

    async def test_profile_not_found(self, pool, redis_client):
        """Non-existent profile -> 401."""
        fake_profile = UUID("00000000-0000-0000-0000-000000000099")

        with pytest.raises(HTTPException) as exc_info:
            await save_persona_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
