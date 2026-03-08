"""Tests for infra.auth.simulatable — simulatable profiles via canonical black boxes.

resolve_simulatable_profiles is tested with mocked black-box fetchers.
Tests verify: role hierarchy, correct arguments flow, chaining, error cases.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.simulatable import (
    SimulatableProfile,
    SimulatableResult,
    resolve_simulatable_profiles,
)
from app.infra.profile_identity_context import ProfileIdentityContext
from app.routes.v5.tools.artifacts.profile.types import GetProfilesResponse
from app.routes.v5.tools.resources.profiles.types import GetProfileResponse
from app.routes.v5.tools.resources.roles.types import GetRoleResponse

NOW = datetime.now(UTC)
MODULE = "app.infra.auth.simulatable"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _identity(*, name="Alice", role="superadmin") -> ProfileIdentityContext:
    return ProfileIdentityContext(
        profiles_id=uuid4(),
        name=name,
        role=role,
        role_name="Admin",
        role_description="Administrator",
        role_artifacts=["agent"],
        primary_email="alice@example.com",
        emails=["alice@example.com"],
        primary_department_id=uuid4(),
        department_ids=[uuid4()],
        settings_id=uuid4(),
        requests_per_day=100,
        is_active=True,
    )


def _role_response(*, role_id=None, role="member", name="Member") -> GetRoleResponse:
    return GetRoleResponse(
        id=role_id or uuid4(),
        role=role,
        name=name,
        description=f"{name} role",
        icon_id=None,
        color_id=None,
        artifacts=["agent"],
        created_at=NOW,
        active=True,
        generated=False,
        mcp=False,
    )


def _profile_artifact(*, profile_id=None, resource_ids=None) -> GetProfilesResponse:
    return GetProfilesResponse(
        id=profile_id or uuid4(),
        created_at=NOW,
        updated_at=NOW,
        generated=False,
        mcp=False,
        active=True,
        profile_ids=resource_ids or [uuid4()],
    )


def _profile_resource(
    *,
    resource_id=None,
    name="Bob",
    role="member",
    emails=None,
    primary_email="bob@example.com",
    department_ids=None,
    requests_per_day=50,
    active=True,
) -> GetProfileResponse:
    return GetProfileResponse(
        id=resource_id or uuid4(),
        name=name,
        description=None,
        role=role,
        department_ids=department_ids or [],
        role_id=None,
        emails=emails or [primary_email],
        primary_email=primary_email,
        requests_per_day=requests_per_day,
        last_login=NOW,
        created_at=NOW,
        active=active,
        mcp=False,
        generated=False,
    )


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_simulatable_profiles — success
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveSimulatableSuccess:
    async def test_superadmin_sees_all_roles(self):
        requester_id = uuid4()
        artifact_id = uuid4()
        resource_id = uuid4()
        identity = _identity(name="Super", role="superadmin")

        # All roles returned
        roles = [
            _role_response(role="superadmin", name="Superadmin"),
            _role_response(role="admin", name="Admin"),
            _role_response(role="instructional", name="Instructional"),
            _role_response(role="member", name="Member"),
            _role_response(role="guest", name="Guest"),
        ]
        artifact = _profile_artifact(profile_id=artifact_id, resource_ids=[resource_id])
        profile = _profile_resource(resource_id=resource_id, name="Target", role="admin")

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([artifact_id], 1)),
            _patch("get_profile_artifacts", [artifact]),
            _patch("get_profile_resources", [profile]),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert isinstance(result, SimulatableResult)
        assert result.actor_name == "Super"
        assert len(result.profiles) == 1
        assert result.profiles[0].name == "Target"
        assert result.profiles[0].profile_id == artifact_id

    async def test_admin_sees_lower_roles_only(self):
        requester_id = uuid4()
        identity = _identity(name="Admin", role="admin")

        role_member_id = uuid4()
        role_guest_id = uuid4()
        roles = [
            _role_response(role_id=uuid4(), role="superadmin", name="Superadmin"),
            _role_response(role_id=uuid4(), role="admin", name="Admin"),
            _role_response(role_id=role_member_id, role="member", name="Member"),
            _role_response(role_id=role_guest_id, role="guest", name="Guest"),
            _role_response(role_id=uuid4(), role="instructional", name="Instructional"),
        ]

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        # Verify only instructional/member/guest role IDs passed
        call_kwargs = mock_search.call_args[1]
        passed_role_ids = set(call_kwargs["role_ids"])
        # admin can simulate instructional, member, guest
        expected_ids = {
            r.id for r in roles if r.role in {"instructional", "member", "guest"}
        }
        assert passed_role_ids == expected_ids
        assert result.profiles == []

    async def test_member_cannot_simulate_anyone(self):
        requester_id = uuid4()
        identity = _identity(name="Member", role="member")

        with _patch("resolve_profile_identity_context", identity):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.actor_name == "Member"
        assert result.profiles == []

    async def test_guest_cannot_simulate_anyone(self):
        requester_id = uuid4()
        identity = _identity(name="Guest", role="guest")

        with _patch("resolve_profile_identity_context", identity):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles == []

    async def test_returns_multiple_profiles(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        aid1, aid2 = uuid4(), uuid4()
        rid1, rid2 = uuid4(), uuid4()
        art1 = _profile_artifact(profile_id=aid1, resource_ids=[rid1])
        art2 = _profile_artifact(profile_id=aid2, resource_ids=[rid2])
        prof1 = _profile_resource(resource_id=rid1, name="Alice")
        prof2 = _profile_resource(resource_id=rid2, name="Bob")

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([aid1, aid2], 2)),
            _patch("get_profile_artifacts", [art1, art2]),
            _patch("get_profile_resources", [prof1, prof2]),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert len(result.profiles) == 2
        assert result.profiles[0].name == "Alice"
        assert result.profiles[1].name == "Bob"

    async def test_passes_search_query_to_search_profiles(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_simulatable_profiles(
                None, None,
                profile_id=requester_id,
                query="bob",
                limit_count=10,
            )

        mock_search.assert_awaited_once()
        call_kwargs = mock_search.call_args[1]
        assert call_kwargs["search"] == "bob"
        assert call_kwargs["limit_count"] == 10
        assert call_kwargs["exclude_ids"] == [requester_id]
        assert call_kwargs["active_only"] is False

    async def test_excludes_requester_from_results(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        call_kwargs = mock_search.call_args[1]
        assert call_kwargs["exclude_ids"] == [requester_id]

    async def test_empty_query_treated_as_none(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_simulatable_profiles(
                None, None,
                profile_id=requester_id,
                query="   ",
            )

        call_kwargs = mock_search.call_args[1]
        assert call_kwargs["search"] is None

    async def test_profile_timestamps_from_artifact(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        artifact_id = uuid4()
        resource_id = uuid4()
        artifact = _profile_artifact(profile_id=artifact_id, resource_ids=[resource_id])
        profile = _profile_resource(resource_id=resource_id)

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([artifact_id], 1)),
            _patch("get_profile_artifacts", [artifact]),
            _patch("get_profile_resources", [profile]),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles[0].created_at == NOW
        assert result.profiles[0].updated_at == NOW


# ═══════════════════════════════════════════════════════════════════════════
# resolve_simulatable_profiles — errors / edge cases
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveSimulatableErrors:
    async def test_missing_profile_raises_value_error(self):
        with _patch("resolve_profile_identity_context", None):
            with pytest.raises(ValueError, match="Profile not found"):
                await resolve_simulatable_profiles(
                    None, None, profile_id=uuid4()
                )

    async def test_no_matching_roles_returns_empty(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        # No roles returned from search
        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", []),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles == []

    async def test_no_artifact_match_returns_empty(self):
        requester_id = uuid4()
        identity = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles == []
        assert result.actor_name == "Alice"
