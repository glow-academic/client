"""Tests for eval_save.save_eval_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
and denormalized snapshot creation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.eval_save import (
    resolve_eval_values,
    save_eval_client,
)
from app.routes.v5.api.main.eval.types import (
    SaveEvalItem,
)

MODULE = "app.infra.eval_save"

pytestmark = pytest.mark.asyncio


# ── Helpers ──────────────────────────────────────────────────────────────────


def _profile(*, role="superadmin", department_ids=None):
    """Fake ProfileContext."""
    p = MagicMock()
    p.role = role
    p.department_ids = department_ids or []
    p.name = "Test User"
    return p


def _perms(*, exists=True, department_ids=None):
    """Fake EvalPermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.department_ids = department_ids or []
    return p


def _create_result(eval_id=None):
    """Fake CreateEvalResponse / UpdateEvalResponse."""
    r = MagicMock()
    r.id = eval_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# ═══════════════════════════════════════════════════════════════════════════
# resolve_eval_values — unit tests
# ═══════════════════════════════════════════════════════════════════════════


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SaveEvalItem(
            name_id=uuid4(),
        )
        errors = await resolve_eval_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value → create_name → sets name_id."""
        name_id = uuid4()
        item = SaveEvalItem(
            name="Test Eval",
        )

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_eval_values(None, None, item, is_update=False)

        assert errors == []
        assert item.name_id == name_id

    async def test_creates_description_from_value(self):
        """Raw description value → create_description → sets description_id."""
        desc_id = uuid4()
        item = SaveEvalItem(
            name_id=uuid4(),
            description="A test eval",
        )

        with patch(
            f"{MODULE}.create_description",
            new_callable=AsyncMock,
            return_value=_resource_result(desc_id),
        ):
            errors = await resolve_eval_values(None, None, item, is_update=False)

        assert errors == []
        assert item.description_id == desc_id

    async def test_matches_department_by_name(self):
        """Raw department value → search_departments → match by name."""
        dept_id = uuid4()
        fake_dept = MagicMock()
        fake_dept.name = "Engineering"
        fake_dept.id = dept_id

        item = SaveEvalItem(
            name_id=uuid4(),
            departments=["engineering"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[fake_dept],
        ):
            errors = await resolve_eval_values(None, None, item, is_update=False)

        assert errors == []
        assert item.department_ids == [dept_id]

    async def test_department_not_found_returns_error(self):
        """Unmatched department value → error."""
        item = SaveEvalItem(
            name_id=uuid4(),
            departments=["nonexistent"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[],
        ):
            errors = await resolve_eval_values(None, None, item, is_update=False)

        assert len(errors) == 1
        assert errors[0].field == "departments"

    async def test_required_fields_on_create(self):
        """Missing required fields on create → errors."""
        item = SaveEvalItem()

        errors = await resolve_eval_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names


# ═══════════════════════════════════════════════════════════════════════════
# save_eval_client — mocked end-to-end tests
# ═══════════════════════════════════════════════════════════════════════════


class TestSaveEvalClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        eval_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveEvalItem(
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
                f"{MODULE}.create_eval_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(eval_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
            patch(
                "app.infra.benchmark_sync.sync_benchmark_entries",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            result = await save_eval_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].eval_id == eval_id

    async def test_create_permission_denied(self):
        """Non-superadmin cannot create."""
        item = SaveEvalItem(name_id=uuid4())
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
            await save_eval_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 403


class TestSaveEvalClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing eval."""
        profile_id = uuid4()
        eval_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveEvalItem(
            input_eval_id=eval_id,
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
                f"{MODULE}.resolve_eval_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            patch(
                f"{MODULE}.update_eval_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(eval_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
            patch(
                "app.infra.benchmark_sync.sync_benchmark_entries",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            result = await save_eval_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].eval_id == eval_id
        assert result.results[0].message == "Eval updated successfully"

    async def test_update_eval_not_found(self):
        """Update with non-existent eval → 404."""
        item = SaveEvalItem(input_eval_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_eval_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(exists=False),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_eval_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 404

    async def test_update_permission_denied(self):
        """Non-superadmin cannot edit."""
        item = SaveEvalItem(input_eval_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="admin"),
            ),
            patch(
                f"{MODULE}.resolve_eval_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_eval_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 403


class TestSaveEvalClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors → errors returned, no transaction."""
        item = SaveEvalItem()  # Missing required fields

        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
        ):
            result = await save_eval_client(
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
        """No profile → 401."""
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
            await save_eval_client(
                conn, redis, profile_id=uuid4(), items=[]
            )

        assert exc_info.value.status_code == 401
