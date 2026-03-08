"""Tests for provider_save.save_provider_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
and denormalized snapshot creation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.provider_save import (
    resolve_provider_values,
    save_provider_client,
)
from app.routes.v5.api.main.provider.types import (
    SaveProviderItem,
)

MODULE = "app.infra.provider_save"

pytestmark = pytest.mark.asyncio


# -- Helpers --


def _profile(*, role="superadmin", department_ids=None):
    """Fake ProfileContext."""
    p = MagicMock()
    p.role = role
    p.department_ids = department_ids or []
    p.name = "Test User"
    return p


def _perms(*, exists=True, department_ids=None, active_model_count=0):
    """Fake ProviderPermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.department_ids = department_ids or []
    p.active_model_count = active_model_count
    return p


def _create_result(provider_id=None):
    """Fake CreateProviderResponse / UpdateProviderResponse."""
    r = MagicMock()
    r.id = provider_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# ======================================================================
# resolve_provider_values -- unit tests
# ======================================================================


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SaveProviderItem(
            name_id=uuid4(),
        )
        errors = await resolve_provider_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value -> create_name -> sets name_id."""
        name_id = uuid4()
        item = SaveProviderItem(
            name="Test Provider",
        )

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_provider_values(None, None, item, is_update=False)

        assert errors == []
        assert item.name_id == name_id

    async def test_creates_description_from_value(self):
        """Raw description value -> create_description -> sets description_id."""
        desc_id = uuid4()
        item = SaveProviderItem(
            name_id=uuid4(),
            description="A test provider",
        )

        with patch(
            f"{MODULE}.create_description",
            new_callable=AsyncMock,
            return_value=_resource_result(desc_id),
        ):
            errors = await resolve_provider_values(None, None, item, is_update=False)

        assert errors == []
        assert item.description_id == desc_id

    async def test_matches_departments_by_name(self):
        """Raw department values -> search_departments -> match by name."""
        dept_id = uuid4()
        fake_dept = MagicMock()
        fake_dept.name = "Engineering"
        fake_dept.id = dept_id

        item = SaveProviderItem(
            name_id=uuid4(),
            departments=["engineering"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[fake_dept],
        ):
            errors = await resolve_provider_values(None, None, item, is_update=False)

        assert errors == []
        assert item.department_ids == [dept_id]

    async def test_department_not_found_returns_error(self):
        """Unmatched department value -> error."""
        item = SaveProviderItem(
            name_id=uuid4(),
            departments=["nonexistent"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[],
        ):
            errors = await resolve_provider_values(None, None, item, is_update=False)

        assert len(errors) == 1
        assert errors[0].field == "departments"

    async def test_required_fields_on_create(self):
        """Missing required fields on create -> errors."""
        item = SaveProviderItem()

        errors = await resolve_provider_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self):
        """Update mode skips required field validation."""
        item = SaveProviderItem()

        errors = await resolve_provider_values(None, None, item, is_update=True)

        assert errors == []


# ======================================================================
# save_provider_client -- mocked end-to-end tests
# ======================================================================


class TestSaveProviderClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        provider_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveProviderItem(
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
                f"{MODULE}.create_provider_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(provider_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_provider_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].provider_id == provider_id

    async def test_create_permission_denied(self):
        """Non-admin cannot create."""
        item = SaveProviderItem(name_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="student"),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_provider_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 403


class TestSaveProviderClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing provider."""
        profile_id = uuid4()
        provider_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveProviderItem(
            input_provider_id=provider_id,
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
                f"{MODULE}.resolve_provider_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            patch(
                f"{MODULE}.update_provider_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(provider_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_provider_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].provider_id == provider_id
        assert result.results[0].message == "Provider updated successfully"

    async def test_update_provider_not_found(self):
        """Update with non-existent provider -> 404."""
        item = SaveProviderItem(input_provider_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_provider_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(exists=False),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_provider_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 404

    async def test_update_permission_denied(self):
        """Cannot edit when active models exist."""
        item = SaveProviderItem(input_provider_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="admin"),
            ),
            patch(
                f"{MODULE}.resolve_provider_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(active_model_count=1),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_provider_client(conn, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 403


class TestSaveProviderClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors -> errors returned, no transaction."""
        item = SaveProviderItem()  # Missing required fields

        conn = AsyncMock()
        redis = AsyncMock()

        with patch(
            f"{MODULE}.resolve_profile_identity_context",
            new_callable=AsyncMock,
            return_value=_profile(),
        ):
            result = await save_provider_client(
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
            await save_provider_client(conn, redis, profile_id=uuid4(), items=[])

        assert exc_info.value.status_code == 401
