"""Tests for department_save.save_department_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
denormalized snapshot creation, and keycloak sync.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.department_save import (
    resolve_department_values,
    save_department_client,
)
from app.routes.v5.api.main.department.types import (
    SaveDepartmentItem,
)

MODULE = "app.infra.department_save"

pytestmark = pytest.mark.asyncio


# -- Helpers --


def _profile(*, role="superadmin", department_ids=None):
    """Fake ProfileContext."""
    p = MagicMock()
    p.role = role
    p.department_ids = department_ids or []
    p.name = "Test User"
    return p


def _perms(*, exists=True, usage_count=0):
    """Fake DepartmentPermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.usage_count = usage_count
    return p


def _create_result(department_id=None):
    """Fake CreateDepartmentResponse / UpdateDepartmentResponse."""
    r = MagicMock()
    r.id = department_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# ======================================================================
# resolve_department_values -- unit tests
# ======================================================================


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SaveDepartmentItem(
            name_id=uuid4(),
        )
        errors = await resolve_department_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value -> create_name -> sets name_id."""
        name_id = uuid4()
        item = SaveDepartmentItem(
            name="Test Department",
        )

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_department_values(
                None, None, item, is_update=False
            )

        assert errors == []
        assert item.name_id == name_id

    async def test_creates_description_from_value(self):
        """Raw description value -> create_description -> sets description_id."""
        desc_id = uuid4()
        item = SaveDepartmentItem(
            name_id=uuid4(),
            description="A test department",
        )

        with patch(
            f"{MODULE}.create_description",
            new_callable=AsyncMock,
            return_value=_resource_result(desc_id),
        ):
            errors = await resolve_department_values(
                None, None, item, is_update=False
            )

        assert errors == []
        assert item.description_id == desc_id

    async def test_required_fields_on_create(self):
        """Missing required fields on create -> errors."""
        item = SaveDepartmentItem()

        errors = await resolve_department_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self):
        """Update mode skips required field validation."""
        item = SaveDepartmentItem()

        errors = await resolve_department_values(None, None, item, is_update=True)

        assert errors == []


# ======================================================================
# save_department_client -- mocked end-to-end tests
# ======================================================================


class TestSaveDepartmentClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        department_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveDepartmentItem(
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
                f"{MODULE}.create_department_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(department_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
            patch(
                f"{MODULE}.perform_keycloak_sync",
                new_callable=AsyncMock,
            ) as mock_sync,
        ):
            result = await save_department_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].department_id == department_id
        # Keycloak sync should have been called
        mock_sync.assert_called_once_with(department_id=str(department_id))

    async def test_create_permission_denied(self):
        """Non-superadmin cannot create department."""
        item = SaveDepartmentItem(name_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="admin"),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_department_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 403


class TestSaveDepartmentClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing department."""
        profile_id = uuid4()
        department_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveDepartmentItem(
            input_department_id=department_id,
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
                f"{MODULE}.resolve_department_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            patch(
                f"{MODULE}.update_department_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(department_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
            patch(
                f"{MODULE}.perform_keycloak_sync",
                new_callable=AsyncMock,
            ),
        ):
            result = await save_department_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].department_id == department_id
        assert result.results[0].message == "Department updated successfully"

    async def test_update_department_not_found(self):
        """Update with non-existent department -> 404."""
        item = SaveDepartmentItem(input_department_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_department_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(exists=False),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_department_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 404

    async def test_update_permission_denied(self):
        """Cannot edit when department is in use."""
        item = SaveDepartmentItem(input_department_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_department_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(usage_count=5),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_department_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 403


class TestSaveDepartmentClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors -> errors returned, no transaction."""
        item = SaveDepartmentItem()  # Missing required fields

        conn = AsyncMock()
        redis = AsyncMock()

        with patch(
            f"{MODULE}.resolve_profile_identity_context",
            new_callable=AsyncMock,
            return_value=_profile(),
        ):
            result = await save_department_client(
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
            await save_department_client(
                conn, redis, profile_id=uuid4(), items=[]
            )

        assert exc_info.value.status_code == 401

    async def test_keycloak_sync_failure_non_fatal(self):
        """Keycloak sync failure does not block save."""
        profile_id = uuid4()
        department_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveDepartmentItem(
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
                f"{MODULE}.create_department_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(department_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
            patch(
                f"{MODULE}.perform_keycloak_sync",
                new_callable=AsyncMock,
                side_effect=Exception("Keycloak down"),
            ),
        ):
            # Should NOT raise despite keycloak failure
            result = await save_department_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
