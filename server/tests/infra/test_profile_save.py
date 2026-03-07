"""Tests for profile_save.save_profile_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
and denormalized snapshot creation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.profile_save import (
    resolve_profile_values,
    save_profile_client,
)
from app.routes.v5.api.main.profile.types import (
    SaveProfileItem,
)

MODULE = "app.infra.profile_save"

pytestmark = pytest.mark.asyncio


# -- Helpers --


def _profile(*, role="superadmin", department_ids=None):
    """Fake ProfileContext."""
    p = MagicMock()
    p.role = role
    p.department_ids = department_ids or []
    p.name = "Test User"
    return p


def _perms(*, exists=True, department_ids=None, active_cohort_count=0):
    """Fake ProfilePermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.department_ids = department_ids or []
    p.active_cohort_count = active_cohort_count
    return p


def _create_result(entity_id=None):
    """Fake CreateProfileResponse / UpdateProfileResponse."""
    r = MagicMock()
    r.id = entity_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# === resolve_profile_values — unit tests ===


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SaveProfileItem(
            name_id=uuid4(),
        )
        errors = await resolve_profile_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value -> create_name -> sets name_id."""
        name_id = uuid4()
        item = SaveProfileItem(
            name="Test Profile",
        )

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_profile_values(None, None, item, is_update=False)

        assert errors == []
        assert item.name_id == name_id

    async def test_required_fields_on_create(self):
        """Missing required fields on create -> errors."""
        item = SaveProfileItem()

        errors = await resolve_profile_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self):
        """Update mode skips required field validation."""
        item = SaveProfileItem()

        errors = await resolve_profile_values(None, None, item, is_update=True)

        assert errors == []

    async def test_matches_departments_by_name(self):
        """Raw department names -> search_departments -> match by name."""
        dept_id = uuid4()
        fake_dept = MagicMock()
        fake_dept.name = "Engineering"
        fake_dept.id = dept_id

        item = SaveProfileItem(
            name_id=uuid4(),
            departments=["engineering"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[fake_dept],
        ):
            errors = await resolve_profile_values(None, None, item, is_update=False)

        assert errors == []
        assert item.department_ids == [dept_id]

    async def test_department_not_found_returns_error(self):
        """Unmatched department name -> error."""
        item = SaveProfileItem(
            name_id=uuid4(),
            departments=["nonexistent"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[],
        ):
            errors = await resolve_profile_values(None, None, item, is_update=False)

        assert len(errors) == 1
        assert errors[0].field == "departments"


# === save_profile_client — mocked end-to-end tests ===


class TestSaveProfileClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        out_profile_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveProfileItem(
            name_id=name_id,
        )

        conn = AsyncMock()
        conn.transaction = MagicMock(
            return_value=AsyncMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
        )
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.create_profile_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(out_profile_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_profile_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].profile_id == out_profile_id

    async def test_create_permission_denied(self):
        """Non-admin cannot create."""
        item = SaveProfileItem(name_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="member"),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_profile_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 403


class TestSaveProfileClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing profile."""
        profile_id = uuid4()
        target_profile_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveProfileItem(
            input_profile_id=target_profile_id,
            name_id=name_id,
        )

        conn = AsyncMock()
        conn.transaction = MagicMock(
            return_value=AsyncMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
        )
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_profile_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            patch(
                f"{MODULE}.update_profile_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(target_profile_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_profile_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].profile_id == target_profile_id
        assert result.results[0].message == "Profile updated successfully"

    async def test_update_profile_not_found(self):
        """Update with non-existent profile -> 404."""
        item = SaveProfileItem(input_profile_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_profile_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(exists=False),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_profile_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 404


class TestSaveProfileClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors -> errors returned, no transaction."""
        item = SaveProfileItem()  # Missing required fields

        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
        ):
            result = await save_profile_client(
                conn,
                redis,
                profile_id=uuid4(),
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is False
        assert result.results[0].errors is not None
        # Transaction should NOT have been entered
        conn.transaction.assert_not_called()

    async def test_profile_not_found(self):
        """No profile -> 401."""
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=None,
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_profile_client(conn, redis, profile_id=uuid4(), items=[])

        assert exc_info.value.status_code == 401
