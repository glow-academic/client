"""Tests for save_new.save_persona_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
and denormalized snapshot creation.
"""

from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.persona_save import (
    save_persona_client,
    resolve_persona_values,
)
from app.routes.v5.api.main.persona.types import (
    SavePersonaFieldError,
    SavePersonaItem,
)

MODULE = "app.infra.persona_save"

pytestmark = pytest.mark.asyncio


# ── Helpers ──────────────────────────────────────────────────────────────────


def _profile(*, role="superadmin", department_ids=None):
    """Fake ProfileContext."""
    p = MagicMock()
    p.role = role
    p.department_ids = department_ids or []
    p.name = "Test User"
    return p


def _perms(*, exists=True, department_ids=None, active_scenario_count=0):
    """Fake PersonaPermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.department_ids = department_ids or []
    p.active_scenario_count = active_scenario_count
    return p


def _create_result(persona_id=None):
    """Fake CreatePersonaResponse / UpdatePersonaResponse."""
    r = MagicMock()
    r.id = persona_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# ═══════════════════════════════════════════════════════════════════════════
# resolve_persona_values — unit tests
# ═══════════════════════════════════════════════════════════════════════════


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SavePersonaItem(
            name_id=uuid4(),
            color_id=uuid4(),
            icon_id=uuid4(),
            instructions_id=uuid4(),
        )
        errors = await resolve_persona_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value → create_name → sets name_id."""
        name_id = uuid4()
        item = SavePersonaItem(
            name="Test Persona",
            color_id=uuid4(),
            icon_id=uuid4(),
            instructions_id=uuid4(),
        )

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_persona_values(None, None, item, is_update=False)

        assert errors == []
        assert item.name_id == name_id

    async def test_matches_color_by_name(self):
        """Raw color value → search_colors → match by name."""
        color_id = uuid4()
        fake_color = MagicMock()
        fake_color.name = "Red"
        fake_color.id = color_id

        item = SavePersonaItem(
            name_id=uuid4(),
            color="red",
            icon_id=uuid4(),
            instructions_id=uuid4(),
        )

        with patch(
            f"{MODULE}.search_colors",
            new_callable=AsyncMock,
            return_value=[fake_color],
        ):
            errors = await resolve_persona_values(None, None, item, is_update=False)

        assert errors == []
        assert item.color_id == color_id

    async def test_color_not_found_returns_error(self):
        """Unmatched color value → error."""
        item = SavePersonaItem(
            name_id=uuid4(),
            color="nonexistent",
            icon_id=uuid4(),
            instructions_id=uuid4(),
        )

        with patch(
            f"{MODULE}.search_colors",
            new_callable=AsyncMock,
            return_value=[],
        ):
            errors = await resolve_persona_values(None, None, item, is_update=False)

        assert len(errors) == 1
        assert errors[0].field == "color"

    async def test_required_fields_on_create(self):
        """Missing required fields on create → errors."""
        item = SavePersonaItem()

        errors = await resolve_persona_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names
        assert "color" in field_names
        assert "icon" in field_names
        assert "instructions" in field_names

    async def test_no_required_validation_on_update(self):
        """Update mode skips required field validation."""
        item = SavePersonaItem()

        errors = await resolve_persona_values(None, None, item, is_update=True)

        assert errors == []

    async def test_creates_examples_from_values(self):
        """Raw examples → create_example per item."""
        ex1_id = uuid4()
        ex2_id = uuid4()

        item = SavePersonaItem(
            name_id=uuid4(),
            color_id=uuid4(),
            icon_id=uuid4(),
            instructions_id=uuid4(),
            examples=["Hello", "Goodbye"],
        )

        with patch(
            f"{MODULE}.create_example",
            new_callable=AsyncMock,
            side_effect=[_resource_result(ex1_id), _resource_result(ex2_id)],
        ):
            errors = await resolve_persona_values(None, None, item, is_update=False)

        assert errors == []
        assert item.example_ids == [ex1_id, ex2_id]


# ═══════════════════════════════════════════════════════════════════════════
# save_persona_client — mocked end-to-end tests
# ═══════════════════════════════════════════════════════════════════════════


class TestSavePersonaClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        persona_id = uuid4()
        name_id = uuid4()
        color_id = uuid4()
        icon_id = uuid4()
        instructions_id = uuid4()
        snapshot_id = uuid4()

        item = SavePersonaItem(
            name_id=name_id,
            color_id=color_id,
            icon_id=icon_id,
            instructions_id=instructions_id,
        )

        conn = AsyncMock()
        conn.transaction = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(), __aexit__=AsyncMock()
        ))
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=_profile()),
            patch(f"{MODULE}.create_persona_artifact", new_callable=AsyncMock, return_value=_create_result(persona_id)),
            patch(f"{MODULE}._create_denormalized_snapshot", new_callable=AsyncMock, return_value=snapshot_id),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_persona_client(
                conn, redis, profile_id=profile_id, items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].persona_id == persona_id

    async def test_create_permission_denied(self):
        """Non-admin cannot create."""
        item = SavePersonaItem(name_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=_profile(role="student")),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_persona_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 403


class TestSavePersonaClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing persona."""
        profile_id = uuid4()
        persona_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SavePersonaItem(
            input_persona_id=persona_id,
            name_id=name_id,
        )

        conn = AsyncMock()
        conn.transaction = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(), __aexit__=AsyncMock()
        ))
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=_profile()),
            patch(f"{MODULE}.resolve_persona_permissions_context", new_callable=AsyncMock, return_value=_perms()),
            patch(f"{MODULE}.update_persona_artifact", new_callable=AsyncMock, return_value=_create_result(persona_id)),
            patch(f"{MODULE}._create_denormalized_snapshot", new_callable=AsyncMock, return_value=snapshot_id),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_persona_client(
                conn, redis, profile_id=profile_id, items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].persona_id == persona_id
        assert result.results[0].message == "Persona updated successfully"

    async def test_update_persona_not_found(self):
        """Update with non-existent persona → 404."""
        item = SavePersonaItem(input_persona_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=_profile()),
            patch(f"{MODULE}.resolve_persona_permissions_context", new_callable=AsyncMock, return_value=_perms(exists=False)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_persona_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 404

    async def test_update_permission_denied(self):
        """Cannot edit when active scenarios exist and not superadmin."""
        item = SavePersonaItem(input_persona_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=_profile(role="admin")),
            patch(f"{MODULE}.resolve_persona_permissions_context", new_callable=AsyncMock, return_value=_perms(active_scenario_count=1)),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_persona_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 403


class TestSavePersonaClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors → errors returned, no transaction."""
        item = SavePersonaItem()  # Missing required fields

        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=_profile()),
        ):
            result = await save_persona_client(
                conn, redis, profile_id=uuid4(), items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is False
        assert result.results[0].errors is not None
        # Transaction should NOT have been entered
        conn.transaction.assert_not_called()

    async def test_profile_not_found(self):
        """No profile → 401."""
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(f"{MODULE}.resolve_profile_identity_context", new_callable=AsyncMock, return_value=None),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_persona_client(conn, redis, profile_id=uuid4(), items=[])

        assert exc_info.value.status_code == 401
