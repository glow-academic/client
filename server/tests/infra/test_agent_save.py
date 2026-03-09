"""Tests for agent_save.save_agent_client — composable save with mocked tools.

Tests verify: permission checks, value resolution, artifact creation/update,
and denormalized snapshot creation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.infra.agent_save import (
    resolve_agent_values,
    save_agent_client,
)
from app.routes.v5.api.main.agent.types import (
    SaveAgentItem,
)

MODULE = "app.infra.agent_save"

pytestmark = pytest.mark.asyncio


# -- Helpers --


def _mock_pool():
    """Create a mock pool with working acquire() context manager."""
    pool = MagicMock()
    conn = AsyncMock()
    conn.transaction = MagicMock(
        return_value=AsyncMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
    )
    acm = AsyncMock()
    acm.__aenter__ = AsyncMock(return_value=conn)
    acm.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acm)
    return pool


def _profile(*, role="superadmin", department_ids=None):
    """Fake ProfileContext."""
    p = MagicMock()
    p.role = role
    p.department_ids = department_ids or [uuid4()]
    p.name = "Test User"
    return p


def _perms(*, exists=True, department_ids=None):
    """Fake AgentPermissionsContext."""
    p = MagicMock()
    p.exists = exists
    p.department_ids = department_ids or []
    return p


def _create_result(artifact_id=None):
    """Fake CreateAgentResponse / UpdateAgentResponse."""
    r = MagicMock()
    r.id = artifact_id or uuid4()
    return r


def _resource_result(resource_id=None):
    """Fake resource create result."""
    r = MagicMock()
    r.id = resource_id or uuid4()
    return r


# ===== resolve_agent_values — unit tests =====


class TestResolveValues:
    async def test_passes_through_ids(self):
        """When IDs are already provided, no create/search calls happen."""
        item = SaveAgentItem(
            name_id=uuid4(),
        )
        errors = await resolve_agent_values(None, None, item, is_update=False)
        assert errors == []

    async def test_creates_name_from_value(self):
        """Raw name value -> create_name -> sets name_id."""
        name_id = uuid4()
        item = SaveAgentItem(name="Test Agent")

        with patch(
            f"{MODULE}.create_name",
            new_callable=AsyncMock,
            return_value=_resource_result(name_id),
        ):
            errors = await resolve_agent_values(None, None, item, is_update=False)

        assert errors == []
        assert item.name_id == name_id

    async def test_creates_description_from_value(self):
        """Raw description value -> create_description -> sets description_id."""
        desc_id = uuid4()
        item = SaveAgentItem(
            name_id=uuid4(),
            description="A test agent",
        )

        with patch(
            f"{MODULE}.create_description",
            new_callable=AsyncMock,
            return_value=_resource_result(desc_id),
        ):
            errors = await resolve_agent_values(None, None, item, is_update=False)

        assert errors == []
        assert item.description_id == desc_id

    async def test_matches_departments_by_name(self):
        """Raw department names -> search_departments -> match by name."""
        dept_id = uuid4()
        fake_dept = MagicMock()
        fake_dept.name = "Engineering"
        fake_dept.id = dept_id

        item = SaveAgentItem(
            name_id=uuid4(),
            departments=["engineering"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[fake_dept],
        ):
            errors = await resolve_agent_values(None, None, item, is_update=False)

        assert errors == []
        assert item.department_ids == [dept_id]

    async def test_department_not_found_returns_error(self):
        """Unmatched department name -> error."""
        item = SaveAgentItem(
            name_id=uuid4(),
            departments=["nonexistent"],
        )

        with patch(
            f"{MODULE}.search_departments",
            new_callable=AsyncMock,
            return_value=[],
        ):
            errors = await resolve_agent_values(None, None, item, is_update=False)

        assert len(errors) == 1
        assert errors[0].field == "departments"

    async def test_required_fields_on_create(self):
        """Missing required fields on create -> errors."""
        item = SaveAgentItem()

        errors = await resolve_agent_values(None, None, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self):
        """Update mode skips required field validation."""
        item = SaveAgentItem()

        errors = await resolve_agent_values(None, None, item, is_update=True)

        assert errors == []


# ===== save_agent_client — mocked end-to-end tests =====


class TestSaveAgentClientCreate:
    async def test_create_success(self):
        """Full create flow with all IDs pre-resolved."""
        profile_id = uuid4()
        agent_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveAgentItem(name_id=name_id)

        pool = _mock_pool()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.create_agent_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(agent_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_agent_client(
                pool,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].agent_id == agent_id

    async def test_create_permission_denied(self):
        """User without departments cannot create."""
        item = SaveAgentItem(name_id=uuid4())
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(role="student", department_ids=[]),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_agent_client(pool, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 403


class TestSaveAgentClientUpdate:
    async def test_update_success(self):
        """Full update flow with existing agent."""
        profile_id = uuid4()
        agent_id = uuid4()
        name_id = uuid4()
        snapshot_id = uuid4()

        item = SaveAgentItem(
            input_agent_id=agent_id,
            name_id=name_id,
        )

        pool = _mock_pool()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_agent_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(),
            ),
            patch(
                f"{MODULE}.update_agent_artifact",
                new_callable=AsyncMock,
                return_value=_create_result(agent_id),
            ),
            patch(
                f"{MODULE}._create_denormalized_snapshot",
                new_callable=AsyncMock,
                return_value=snapshot_id,
            ),
            patch(f"{MODULE}.invalidate_tags", new_callable=AsyncMock),
        ):
            result = await save_agent_client(
                pool,
                redis,
                profile_id=profile_id,
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].agent_id == agent_id
        assert result.results[0].message == "Agent updated successfully"

    async def test_update_agent_not_found(self):
        """Update with non-existent agent -> 404."""
        item = SaveAgentItem(input_agent_id=uuid4())
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
            patch(
                f"{MODULE}.resolve_agent_permissions_context",
                new_callable=AsyncMock,
                return_value=_perms(exists=False),
            ),
            pytest.raises(HTTPException) as exc_info,
        ):
            await save_agent_client(pool, redis, profile_id=uuid4(), items=[item])

        assert exc_info.value.status_code == 404


class TestSaveAgentClientValidation:
    async def test_validation_errors_returned_without_mutation(self):
        """Items with resolution errors -> errors returned, no transaction."""
        item = SaveAgentItem()  # Missing required fields

        pool = _mock_pool()
        redis = AsyncMock()

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context",
                new_callable=AsyncMock,
                return_value=_profile(),
            ),
        ):
            result = await save_agent_client(
                pool,
                redis,
                profile_id=uuid4(),
                items=[item],
            )

        assert len(result.results) == 1
        assert result.results[0].success is False
        assert result.results[0].errors is not None

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
            await save_agent_client(conn, redis, profile_id=uuid4(), items=[])

        assert exc_info.value.status_code == 401
