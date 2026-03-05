"""Tests for infra.profile_context — profile context resolution.

resolve_profile_context is tested with mocked black-box resource fetchers.
"""

from datetime import datetime, UTC
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.profile_context import ProfileContext, resolve_profile_context
from app.routes.v5.tools.artifacts.profile.types import GetProfilesResponse
from app.routes.v5.tools.resources.departments.types import GetDepartmentResponse
from app.routes.v5.tools.resources.emails.types import GetEmailResponse
from app.routes.v5.tools.resources.names.types import GetNameResponse
from app.routes.v5.tools.resources.roles.types import GetRoleResponse


NOW = datetime.now(UTC)
MODULE = "app.infra.profile_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _profile_artifact(
    *,
    profile_id=None,
    name_ids=None,
    role_ids=None,
    department_ids=None,
    email_ids=None,
    profile_ids=None,
    flag_ids=None,
    active=True,
) -> GetProfilesResponse:
    return GetProfilesResponse(
        id=profile_id or uuid4(),
        created_at=NOW,
        updated_at=NOW,
        generated=False,
        mcp=False,
        active=active,
        name_ids=name_ids,
        role_ids=role_ids,
        department_ids=department_ids,
        email_ids=email_ids,
        profile_ids=profile_ids,
        flag_ids=flag_ids,
    )


def _name(*, name_id=None, name="Test User") -> GetNameResponse:
    return GetNameResponse(
        id=name_id or uuid4(),
        name=name,
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _role(
    *,
    role_id=None,
    role="admin",
    name="Admin",
    description="Administrator role",
    artifacts=None,
) -> GetRoleResponse:
    return GetRoleResponse(
        id=role_id or uuid4(),
        role=role,
        name=name,
        description=description,
        icon_id=None,
        color_id=None,
        artifacts=artifacts or ["persona", "scenario"],
        created_at=NOW,
        active=True,
        generated=False,
        mcp=False,
    )


def _department(
    *,
    dept_id=None,
    name="Engineering",
    is_primary=False,
    setting_ids=None,
) -> GetDepartmentResponse:
    return GetDepartmentResponse(
        id=dept_id or uuid4(),
        name=name,
        description=None,
        department_ids=[],
        setting_ids=setting_ids or [],
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
        is_primary=is_primary,
    )


def _email(
    *,
    email_id=None,
    email="user@example.com",
    is_primary=False,
) -> GetEmailResponse:
    return GetEmailResponse(
        id=email_id or uuid4(),
        email=email,
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
        is_primary=is_primary,
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveProfileContextEmpty:
    async def test_no_profile_returns_none(self):
        with patch(
            f"{MODULE}.get_profile_artifacts",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await resolve_profile_context(None, uuid4(), None)
        assert result is None

    async def test_no_profiles_junction_returns_none(self):
        artifact = _profile_artifact(profile_ids=[])
        with patch(
            f"{MODULE}.get_profile_artifacts",
            new_callable=AsyncMock,
            return_value=[artifact],
        ):
            result = await resolve_profile_context(None, artifact.id, None)
        assert result is None


@pytest.mark.asyncio
class TestResolveProfileContextFull:
    async def test_full_hydration(self):
        profiles_id = uuid4()
        name_id = uuid4()
        role_id = uuid4()
        dept_id = uuid4()
        email_id = uuid4()
        settings_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[name_id],
            role_ids=[role_id],
            department_ids=[dept_id],
            email_ids=[email_id],
            profile_ids=[profiles_id],
        )

        name = _name(name_id=name_id, name="Jane Doe")
        role = _role(
            role_id=role_id,
            role="superadmin",
            name="Super Admin",
            description="Full access",
            artifacts=["persona", "scenario", "rubric"],
        )
        dept = _department(
            dept_id=dept_id,
            name="Organization",
            is_primary=True,
            setting_ids=[settings_id],
        )
        email = _email(
            email_id=email_id,
            email="jane@org.com",
            is_primary=True,
        )

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[name]),
            patch(f"{MODULE}.get_roles", new_callable=AsyncMock, return_value=[role]),
            patch(f"{MODULE}.get_departments", new_callable=AsyncMock, return_value=[dept]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[email]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.profiles_id == profiles_id
        assert result.name == "Jane Doe"
        assert result.role == "superadmin"
        assert result.role_name == "Super Admin"
        assert result.role_description == "Full access"
        assert result.role_artifacts == ["persona", "scenario", "rubric"]
        assert result.primary_email == "jane@org.com"
        assert result.emails == ["jane@org.com"]
        assert result.primary_department_id == dept_id
        assert result.department_ids == [dept_id]
        assert result.settings_id == settings_id
        assert result.is_active is True

    async def test_multiple_departments_picks_primary(self):
        profiles_id = uuid4()
        dept_primary_id = uuid4()
        dept_other_id = uuid4()
        settings_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[uuid4()],
            role_ids=[uuid4()],
            department_ids=[dept_primary_id, dept_other_id],
            email_ids=[],
            profile_ids=[profiles_id],
        )

        dept_primary = _department(
            dept_id=dept_primary_id,
            name="Organization",
            is_primary=True,
            setting_ids=[settings_id],
        )
        dept_other = _department(
            dept_id=dept_other_id,
            name="University",
            is_primary=False,
        )

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[_name()]),
            patch(f"{MODULE}.get_roles", new_callable=AsyncMock, return_value=[_role()]),
            patch(f"{MODULE}.get_departments", new_callable=AsyncMock, return_value=[dept_primary, dept_other]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.primary_department_id == dept_primary_id
        assert result.settings_id == settings_id
        assert set(result.department_ids) == {dept_primary_id, dept_other_id}

    async def test_multiple_emails_picks_primary(self):
        profiles_id = uuid4()
        email_primary_id = uuid4()
        email_other_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[uuid4()],
            role_ids=[uuid4()],
            department_ids=[],
            email_ids=[email_primary_id, email_other_id],
            profile_ids=[profiles_id],
        )

        email_primary = _email(
            email_id=email_primary_id,
            email="primary@org.com",
            is_primary=True,
        )
        email_other = _email(
            email_id=email_other_id,
            email="secondary@org.com",
            is_primary=False,
        )

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[_name()]),
            patch(f"{MODULE}.get_roles", new_callable=AsyncMock, return_value=[_role()]),
            patch(f"{MODULE}.get_departments", new_callable=AsyncMock, return_value=[]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[email_primary, email_other]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.primary_email == "primary@org.com"
        assert result.emails == ["primary@org.com", "secondary@org.com"]

    async def test_no_primary_department_returns_none_settings(self):
        profiles_id = uuid4()
        dept_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[uuid4()],
            role_ids=[uuid4()],
            department_ids=[dept_id],
            email_ids=[],
            profile_ids=[profiles_id],
        )

        dept = _department(dept_id=dept_id, is_primary=False)

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[_name()]),
            patch(f"{MODULE}.get_roles", new_callable=AsyncMock, return_value=[_role()]),
            patch(f"{MODULE}.get_departments", new_callable=AsyncMock, return_value=[dept]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.primary_department_id is None
        assert result.settings_id is None

    async def test_inactive_profile(self):
        profiles_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[uuid4()],
            role_ids=[uuid4()],
            department_ids=[],
            email_ids=[],
            profile_ids=[profiles_id],
            active=False,
        )

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[_name()]),
            patch(f"{MODULE}.get_roles", new_callable=AsyncMock, return_value=[_role()]),
            patch(f"{MODULE}.get_departments", new_callable=AsyncMock, return_value=[]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.is_active is False

    async def test_no_role_returns_empty_strings(self):
        profiles_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[uuid4()],
            role_ids=[],
            department_ids=[],
            email_ids=[],
            profile_ids=[profiles_id],
        )

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[_name()]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.role == ""
        assert result.role_name == ""
        assert result.role_description == ""
        assert result.role_artifacts == []

    async def test_primary_department_without_settings(self):
        """Primary department exists but has empty setting_ids."""
        profiles_id = uuid4()
        dept_id = uuid4()

        artifact = _profile_artifact(
            name_ids=[uuid4()],
            role_ids=[uuid4()],
            department_ids=[dept_id],
            email_ids=[],
            profile_ids=[profiles_id],
        )

        dept = _department(dept_id=dept_id, is_primary=True, setting_ids=[])

        with (
            patch(f"{MODULE}.get_profile_artifacts", new_callable=AsyncMock, return_value=[artifact]),
            patch(f"{MODULE}.get_names", new_callable=AsyncMock, return_value=[_name()]),
            patch(f"{MODULE}.get_roles", new_callable=AsyncMock, return_value=[_role()]),
            patch(f"{MODULE}.get_departments", new_callable=AsyncMock, return_value=[dept]),
            patch(f"{MODULE}.get_emails", new_callable=AsyncMock, return_value=[]),
        ):
            result = await resolve_profile_context(None, artifact.id, None)

        assert result is not None
        assert result.primary_department_id == dept_id
        assert result.settings_id is None
