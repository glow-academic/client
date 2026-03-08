"""Tests for infra.auth.callback — redirect resolution via canonical black boxes.

resolve_callback_redirect is tested with mocked black-box fetchers.
Tests verify: role-based redirect, missing profile fallback.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.callback import resolve_callback_redirect
from app.infra.profile_identity_context import ProfileIdentityContext

MODULE = "app.infra.auth.callback"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _identity(*, role="admin") -> ProfileIdentityContext:
    return ProfileIdentityContext(
        profiles_id=uuid4(),
        name="Alice",
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


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_callback_redirect
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveCallbackRedirect:
    async def test_none_profile_returns_home(self):
        result = await resolve_callback_redirect(None, None, profile_id=None)
        assert result == "/home"

    async def test_missing_identity_returns_home(self):
        with _patch("resolve_profile_identity_context", None):
            result = await resolve_callback_redirect(
                None, None, profile_id=uuid4()
            )
        assert result == "/home"

    async def test_member_redirects_to_home(self):
        identity = _identity(role="member")
        with _patch("resolve_profile_identity_context", identity):
            result = await resolve_callback_redirect(
                None, None, profile_id=uuid4()
            )
        assert result == "/home"

    async def test_superadmin_redirects_to_home(self):
        identity = _identity(role="superadmin")
        with _patch("resolve_profile_identity_context", identity):
            result = await resolve_callback_redirect(
                None, None, profile_id=uuid4()
            )
        assert result == "/home"

    async def test_admin_redirects_to_home(self):
        identity = _identity(role="admin")
        with _patch("resolve_profile_identity_context", identity):
            result = await resolve_callback_redirect(
                None, None, profile_id=uuid4()
            )
        assert result == "/home"

    async def test_guest_redirects_to_home_fallback(self):
        identity = _identity(role="guest")
        with _patch("resolve_profile_identity_context", identity):
            result = await resolve_callback_redirect(
                None, None, profile_id=uuid4()
            )
        # guest uses first_available_route which is "/home" fallback
        assert result == "/home"

    async def test_passes_bypass_cache_to_identity(self):
        identity = _identity(role="member")
        with _patch("resolve_profile_identity_context", identity) as mock_id:
            await resolve_callback_redirect(
                "fake_conn", "fake_redis",
                profile_id=uuid4(),
                bypass_cache=True,
            )

        call_kwargs = mock_id.call_args
        assert call_kwargs[1]["bypass_cache"] is True
