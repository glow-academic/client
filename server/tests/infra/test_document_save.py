"""Tests for document_save.save_document_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
and denormalized snapshot creation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.document_save import (
    resolve_document_values,
    save_document_client,
)
from app.routes.v5.api.main.document.types import (
    SaveDocumentItem,
)

MODULE = "app.infra.document_save"

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
    """Fake DocumentPermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.department_ids = department_ids or []
    p.active_scenario_count = active_scenario_count
    return p


def _create_result(document_id=None):
    """Fake CreateDocumentResponse / UpdateDocumentResponse."""
    r = MagicMock()
    r.id = document_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# ═══════════════════════════════════════════════════════════════════════════
# resolve_document_values — unit tests
# ═══════════════════════════════════════════════════════════════════════════


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SaveDocumentItem(
            name_id=uuid4(),
        )
        errors = await resolve_document_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value → create_name → sets name_id."""
        name_id = uuid4()
        item = SaveDocumentItem(
            name="Test Document",
        )

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_document_values(None, None, item, is_update=False)

        assert errors == []
        assert item.name_id == name_id

    async def test_creates_description_from_value(self):
        """Raw description value → create_description → sets description_id."""
        desc_id = uuid4()
        item = SaveDocumentItem(
            name_id=uuid4(),
            description="A test document",
        )

        with patch(
            f"{MODULE}.create_description",
            new_callable=AsyncMock,
            return_value=_resource_result(desc_id),
        ):
            errors = await resolve_document_values(None, None, item, is_update=False)

        assert errors == []
        assert item.description_id == desc_id

    async def test_matches_department_by_name(self):
        """Raw department value → search_departments → match by name."""
        dept_id = uuid4()
        fake_dept = MagicMock()
        fake_dept.name = "Engineering"
        fake_dept.id = dept_id

        item = SaveDocumentItem(
            name_id=uuid4(),
            departments=["engineering"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[fake_dept],
        ):
            errors = await resolve_document_values(None, None, item, is_update=False)

        assert errors == []
        assert item.department_ids == [dept_id]

    async def test_department_not_found_returns_error(self):
        """Unmatched department value → error."""
        item = SaveDocumentItem(
            name_id=uuid4(),
            departments=["nonexistent"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[],
        ):
            errors = await resolve_document_values(None, None, item, is_update=False)

        assert len(errors) == 1
        assert errors[0].field == "departments"

    async def test_required_fields_on_create(self):
        """Missing required fields on create → errors."""
        item = SaveDocumentItem()

        errors = await resolve_document_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_is_inactive_resolves_flag(self):
        """is_inactive=False → searches for document_active flag."""
        flag_id = uuid4()
        fake_flag = MagicMock()
        fake_flag.type = "document_active"
        fake_flag.id = flag_id

        item = SaveDocumentItem(
            name_id=uuid4(),
            is_inactive=False,
        )

        with patch(
            f"{MODULE}.search_flags",
            new_callable=AsyncMock,
            return_value=[fake_flag],
        ):
            errors = await resolve_document_values(None, None, item, is_update=False)

        assert errors == []
        assert item.flag_id == flag_id

    async def test_is_inactive_true_leaves_flag_none(self):
        """is_inactive=True → flag_id stays None."""
        fake_flag = MagicMock()
        fake_flag.type = "document_active"
        fake_flag.id = uuid4()

        item = SaveDocumentItem(
            name_id=uuid4(),
            is_inactive=True,
        )

        with patch(
            f"{MODULE}.search_flags",
            new_callable=AsyncMock,
            return_value=[fake_flag],
        ):
            errors = await resolve_document_values(None, None, item, is_update=False)

        assert errors == []
        assert item.flag_id is None


# ═══════════════════════════════════════════════════════════════════════════
# save_document_client — mocked end-to-end tests
# ═══════════════════════════════════════════════════════════════════════════


class TestSaveDocumentClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        document_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveDocumentItem(
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
                f"{MODULE}.create_document_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(document_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_document_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].document_id == document_id

    async def test_create_permission_denied(self):
        """Non-admin cannot create."""
        item = SaveDocumentItem(name_id=uuid4())
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
            await save_document_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 403


class TestSaveDocumentClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing document."""
        profile_id = uuid4()
        document_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveDocumentItem(
            input_document_id=document_id,
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
                f"{MODULE}.resolve_document_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            patch(
                f"{MODULE}.update_document_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(document_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_document_client(
                conn,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].document_id == document_id
        assert result.results[0].message == "Document updated successfully"

    async def test_update_document_not_found(self):
        """Update with non-existent document → 404."""
        item = SaveDocumentItem(input_document_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_document_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(exists=False),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_document_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 404

    async def test_update_permission_denied(self):
        """Cannot edit when active scenarios exist."""
        item = SaveDocumentItem(input_document_id=uuid4())
        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="admin"),
            ),
            patch(
                f"{MODULE}.resolve_document_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(active_scenario_count=1),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_document_client(
                conn, redis, profile_id=uuid4(), items=[item]
            )

        assert exc_info.value.status_code == 403


class TestSaveDocumentClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors → errors returned, no transaction."""
        item = SaveDocumentItem()  # Missing required fields

        conn = AsyncMock()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
        ):
            result = await save_document_client(
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
            await save_document_client(
                conn, redis, profile_id=uuid4(), items=[]
            )

        assert exc_info.value.status_code == 401

    async def test_bulk_create_multiple_items(self):
        """Bulk create with multiple items succeeds."""
        profile_id = uuid4()
        doc1_id = uuid4()
        doc2_id = uuid4()
        snapshot_id = uuid4()

        items = [
            SaveDocumentItem(name_id=uuid4()),
            SaveDocumentItem(name_id=uuid4()),
        ]

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
                f"{MODULE}.create_document_artifact",
                new_callable=AsyncMock,
                side_effect=[_create_result(doc1_id), _create_result(doc2_id)],
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_document_client(
                conn,
                redis,
                profile_id=profile_id,
                items=items,
            )

        assert len(result.results) == 2
        assert result.results[0].success is True
        assert result.results[0].document_id == doc1_id
        assert result.results[1].success is True
        assert result.results[1].document_id == doc2_id
