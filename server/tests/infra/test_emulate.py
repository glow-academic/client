"""Tests for infra.auth.emulate — emulation grant via canonical black boxes.

resolve_emulation is tested with mocked black-box fetchers.
Tests verify: authorization, correct arguments flow, error cases.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.emulate import EmulationResult, resolve_emulation
from app.infra.profile_identity_context import ProfileIdentityContext
from app.routes.v5.tools.entries.emulations.types import CreateEmulationResponse
from app.routes.v5.tools.entries.grants.types import CreateGrantResponse
from app.routes.v5.tools.entries.sessions.types import GetSessionResponse

NOW = datetime.now(UTC)
MODULE = "app.infra.auth.emulate"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _identity(
    *,
    profiles_id=None,
    name="Alice",
    role="superadmin",
) -> ProfileIdentityContext:
    return ProfileIdentityContext(
        profiles_id=profiles_id or uuid4(),
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


def _session(*, session_id=None, profile_id=None) -> GetSessionResponse:
    return GetSessionResponse(
        id=session_id or uuid4(),
        profile_id=profile_id or uuid4(),
        created_at=NOW,
        active=True,
        mcp=False,
    )


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_emulation — success
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveEmulationSuccess:
    async def test_superadmin_can_emulate_member(self):
        requester_id = uuid4()
        target_id = uuid4()
        req_resource_id = uuid4()
        tgt_resource_id = uuid4()
        grant_id = uuid4()

        requester = _identity(
            profiles_id=req_resource_id, name="Super", role="superadmin"
        )
        target = _identity(profiles_id=tgt_resource_id, name="Member", role="member")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            _patch("search_sessions", [_session()]),
            _patch("create_grant", CreateGrantResponse(id=grant_id)),
            _patch("create_emulation", CreateEmulationResponse(id=uuid4())),
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert isinstance(result, EmulationResult)
        assert result.allowed is True
        assert result.reason is None
        assert result.actor_name == "Super"
        assert result.grant_id == grant_id
        assert result.target_profile_id == target_id
        assert result.redirect_url is not None
        assert result.logout_url is not None
        assert result.emulate_page_url is not None

    async def test_self_emulation_allowed(self):
        profile_id = uuid4()
        resource_id = uuid4()
        grant_id = uuid4()

        identity = _identity(profiles_id=resource_id, name="Self", role="member")

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("search_sessions", [_session()]),
            _patch("create_grant", CreateGrantResponse(id=grant_id)),
            _patch("create_emulation", CreateEmulationResponse(id=uuid4())),
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=profile_id,
                target_profile_id=profile_id,
            )

        assert result.allowed is True

    async def test_passes_correct_args_to_create_grant(self):
        requester_id = uuid4()
        target_id = uuid4()
        req_resource_id = uuid4()
        tgt_resource_id = uuid4()
        req_session_id = uuid4()
        tgt_session_id = uuid4()

        requester = _identity(profiles_id=req_resource_id, role="superadmin")
        target = _identity(profiles_id=tgt_resource_id, role="member")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        async def _mock_sessions(conn, profile_ids=None, active=None, limit=None):
            if profile_ids == [req_resource_id]:
                return [_session(session_id=req_session_id)]
            if profile_ids == [tgt_resource_id]:
                return [_session(session_id=tgt_session_id)]
            return []

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            patch(f"{MODULE}.search_sessions", side_effect=_mock_sessions),
            _patch("create_grant", CreateGrantResponse(id=uuid4())) as mock_grant,
            _patch("create_emulation", CreateEmulationResponse(id=uuid4())),
        ):
            await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
                ttl_minutes=60,
            )

        mock_grant.assert_awaited_once()
        call_kwargs = mock_grant.call_args[1]
        assert call_kwargs["session_id"] == req_session_id
        assert call_kwargs["profiles_id"] == req_resource_id

    async def test_passes_correct_args_to_create_emulation(self):
        requester_id = uuid4()
        target_id = uuid4()
        req_resource_id = uuid4()
        tgt_resource_id = uuid4()
        req_session_id = uuid4()
        tgt_session_id = uuid4()
        grant_id = uuid4()

        requester = _identity(profiles_id=req_resource_id, role="superadmin")
        target = _identity(profiles_id=tgt_resource_id, role="member")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        async def _mock_sessions(conn, profile_ids=None, active=None, limit=None):
            if profile_ids == [req_resource_id]:
                return [_session(session_id=req_session_id)]
            if profile_ids == [tgt_resource_id]:
                return [_session(session_id=tgt_session_id)]
            return []

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            patch(f"{MODULE}.search_sessions", side_effect=_mock_sessions),
            _patch("create_grant", CreateGrantResponse(id=grant_id)),
            _patch(
                "create_emulation", CreateEmulationResponse(id=uuid4())
            ) as mock_emul,
        ):
            await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        mock_emul.assert_awaited_once()
        call_kwargs = mock_emul.call_args[1]
        assert call_kwargs["grant_id"] == grant_id
        assert call_kwargs["session_id"] == tgt_session_id
        assert call_kwargs["profile_id"] == tgt_resource_id

    async def test_redirect_url_contains_grant_id(self):
        requester_id = uuid4()
        target_id = uuid4()
        grant_id = uuid4()

        requester = _identity(role="superadmin")
        target = _identity(role="member")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            _patch("search_sessions", [_session()]),
            _patch("create_grant", CreateGrantResponse(id=grant_id)),
            _patch("create_emulation", CreateEmulationResponse(id=uuid4())),
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert str(grant_id) in result.redirect_url
        assert str(grant_id) in result.emulate_page_url
        assert "login_hint=" in result.redirect_url


# ═══════════════════════════════════════════════════════════════════════════
# resolve_emulation — authorization failures
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveEmulationAuth:
    async def test_requester_not_found(self):
        with _patch("resolve_profile_identity_context", None):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=uuid4(),
                target_profile_id=uuid4(),
            )

        assert result.allowed is False
        assert result.reason == "Requester profile not found"

    async def test_target_not_found(self):
        requester_id = uuid4()
        target_id = uuid4()
        requester = _identity(role="superadmin")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            return None

        with patch(
            f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert result.allowed is False
        assert result.reason == "Target profile not found"
        assert result.actor_name == requester.name

    async def test_member_cannot_emulate_admin(self):
        requester_id = uuid4()
        target_id = uuid4()
        requester = _identity(role="member")
        target = _identity(role="admin")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        with patch(
            f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert result.allowed is False
        assert result.reason == "You do not have permission to emulate this profile"

    async def test_admin_cannot_emulate_superadmin(self):
        requester_id = uuid4()
        target_id = uuid4()
        requester = _identity(role="admin")
        target = _identity(role="superadmin")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        with patch(
            f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert result.allowed is False

    async def test_no_requester_session_returns_not_allowed(self):
        requester_id = uuid4()
        target_id = uuid4()
        requester = _identity(role="superadmin")
        target = _identity(role="member")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            _patch("search_sessions", []),
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert result.allowed is False
        assert "session" in result.reason.lower()

    async def test_no_target_session_returns_not_allowed(self):
        requester_id = uuid4()
        target_id = uuid4()
        req_resource_id = uuid4()
        tgt_resource_id = uuid4()
        requester = _identity(profiles_id=req_resource_id, role="superadmin")
        target = _identity(profiles_id=tgt_resource_id, role="member")

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            if pid == requester_id:
                return requester
            if pid == target_id:
                return target
            return None

        async def _mock_sessions(conn, profile_ids=None, active=None, limit=None):
            if profile_ids == [req_resource_id]:
                return [_session()]
            return []

        with (
            patch(
                f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity
            ),
            patch(f"{MODULE}.search_sessions", side_effect=_mock_sessions),
        ):
            result = await resolve_emulation(
                None,
                None,
                requester_profile_id=requester_id,
                target_profile_id=target_id,
            )

        assert result.allowed is False
        assert "session" in result.reason.lower()
