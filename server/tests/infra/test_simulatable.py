"""Tests for infra.auth.simulatable — simulatable profiles via canonical black boxes.

resolve_simulatable_profiles is tested with mocked black-box fetchers.
Tests verify: role hierarchy, correct arguments flow, chaining, error cases.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.simulatable import (
    SimulatableResult,
    resolve_simulatable_profiles,
)
from app.infra.profile_identity_context import ProfileIdentityContext
from app.routes.v5.tools.resources.roles.types import GetRoleResponse

NOW = datetime.now(UTC)
MODULE = "app.infra.auth.simulatable"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _identity(
    *,
    name="Alice",
    role="superadmin",
    primary_email="alice@example.com",
    emails=None,
    primary_department_id=None,
    requests_per_day=100,
    is_active=True,
) -> ProfileIdentityContext:
    return ProfileIdentityContext(
        profiles_id=uuid4(),
        name=name,
        role=role,
        role_name="Admin",
        role_description="Administrator",
        role_artifacts=["agent"],
        primary_email=primary_email,
        emails=emails or [primary_email],
        primary_department_id=primary_department_id or uuid4(),
        department_ids=[primary_department_id or uuid4()],
        settings_id=uuid4(),
        requests_per_day=requests_per_day,
        is_active=is_active,
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
        target_id = uuid4()
        requester = _identity(name="Super", role="superadmin")
        target = _identity(name="Target", role="admin")

        roles = [
            _role_response(role="superadmin", name="Superadmin"),
            _role_response(role="admin", name="Admin"),
            _role_response(role="instructional", name="Instructional"),
            _role_response(role="member", name="Member"),
            _role_response(role="guest", name="Guest"),
        ]

        call_count = 0

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            nonlocal call_count
            call_count += 1
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            _patch("search_roles", roles),
            _patch("search_profiles", ([target_id], 1)),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert isinstance(result, SimulatableResult)
        assert result.actor_name == "Super"
        assert len(result.profiles) == 1
        assert result.profiles[0].name == "Target"
        assert result.profiles[0].profile_id == target_id

    async def test_admin_sees_lower_roles_only(self):
        requester_id = uuid4()
        requester = _identity(name="Admin", role="admin")

        roles = [
            _role_response(role_id=uuid4(), role="superadmin", name="Superadmin"),
            _role_response(role_id=uuid4(), role="admin", name="Admin"),
            _role_response(role_id=uuid4(), role="member", name="Member"),
            _role_response(role_id=uuid4(), role="guest", name="Guest"),
            _role_response(role_id=uuid4(), role="instructional", name="Instructional"),
        ]

        with (
            _patch("resolve_profile_identity_context", requester),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        # Verify only instructional/member/guest role IDs passed
        call_kwargs = mock_search.call_args[1]
        passed_role_ids = set(call_kwargs["role_ids"])
        expected_ids = {
            r.id for r in roles if r.role in {"instructional", "member", "guest"}
        }
        assert passed_role_ids == expected_ids
        assert result.profiles == []

    async def test_member_cannot_simulate_anyone(self):
        requester_id = uuid4()
        requester = _identity(name="Member", role="member")

        with _patch("resolve_profile_identity_context", requester):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.actor_name == "Member"
        assert result.profiles == []

    async def test_guest_cannot_simulate_anyone(self):
        requester_id = uuid4()
        requester = _identity(name="Guest", role="guest")

        with _patch("resolve_profile_identity_context", requester):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles == []

    async def test_returns_multiple_profiles(self):
        requester_id = uuid4()
        aid1, aid2 = uuid4(), uuid4()
        requester = _identity(role="superadmin")
        target1 = _identity(name="Alice", role="member")
        target2 = _identity(name="Bob", role="member")
        roles = [_role_response(role="member")]

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == aid1:
                return target1
            if pid == aid2:
                return target2
            return None

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            _patch("search_roles", roles),
            _patch("search_profiles", ([aid1, aid2], 2)),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert len(result.profiles) == 2
        assert result.profiles[0].name == "Alice"
        assert result.profiles[1].name == "Bob"

    async def test_passes_search_query_to_search_profiles(self):
        requester_id = uuid4()
        requester = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", requester),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_simulatable_profiles(
                None,
                None,
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
        requester = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", requester),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_simulatable_profiles(None, None, profile_id=requester_id)

        call_kwargs = mock_search.call_args[1]
        assert call_kwargs["exclude_ids"] == [requester_id]

    async def test_empty_query_treated_as_none(self):
        requester_id = uuid4()
        requester = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", requester),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_simulatable_profiles(
                None,
                None,
                profile_id=requester_id,
                query="   ",
            )

        call_kwargs = mock_search.call_args[1]
        assert call_kwargs["search"] is None


# ═══════════════════════════════════════════════════════════════════════════
# resolve_simulatable_profiles — errors / edge cases
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveSimulatableErrors:
    async def test_missing_profile_raises_value_error(self):
        with _patch("resolve_profile_identity_context", None):
            with pytest.raises(ValueError, match="Profile not found"):
                await resolve_simulatable_profiles(None, None, profile_id=uuid4())

    async def test_no_matching_roles_returns_empty(self):
        requester_id = uuid4()
        requester = _identity(role="superadmin")

        with (
            _patch("resolve_profile_identity_context", requester),
            _patch("search_roles", []),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles == []

    async def test_no_artifact_match_returns_empty(self):
        requester_id = uuid4()
        requester = _identity(role="superadmin")
        roles = [_role_response(role="member")]

        with (
            _patch("resolve_profile_identity_context", requester),
            _patch("search_roles", roles),
            _patch("search_profiles", ([], 0)),
        ):
            result = await resolve_simulatable_profiles(
                None, None, profile_id=requester_id
            )

        assert result.profiles == []
        assert result.actor_name == "Alice"
