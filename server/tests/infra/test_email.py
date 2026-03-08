"""Tests for infra.auth.email — profile-by-email lookup via canonical black boxes.

resolve_profile_by_email is tested with mocked black-box fetchers.
Tests verify: correct arguments flow, chaining, error cases.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.email import ProfileByEmailResult, resolve_profile_by_email
from app.infra.profile_identity_context import ProfileIdentityContext
from app.routes.v5.tools.artifacts.profile.types import GetProfilesResponse
from app.routes.v5.tools.resources.emails.types import GetEmailResponse

NOW = datetime.now(UTC)
MODULE = "app.infra.auth.email"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _identity(
    *,
    profiles_id=None,
    name="Alice",
    role="admin",
    primary_email="alice@example.com",
    emails=None,
    primary_department_id=None,
    requests_per_day=100,
    is_active=True,
) -> ProfileIdentityContext:
    return ProfileIdentityContext(
        profiles_id=profiles_id or uuid4(),
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


def _email_response(*, email_id=None, email="alice@example.com", is_primary=True) -> GetEmailResponse:
    return GetEmailResponse(
        id=email_id or uuid4(),
        email=email,
        is_primary=is_primary,
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _profile_artifact(*, profile_id=None) -> GetProfilesResponse:
    return GetProfilesResponse(
        id=profile_id or uuid4(),
        created_at=NOW,
        updated_at=NOW,
        generated=False,
        mcp=False,
        active=True,
    )


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_by_email — success
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveProfileByEmailSuccess:
    async def test_returns_full_result(self):
        email_id = uuid4()
        profile_id = uuid4()
        dept_id = uuid4()
        identity = _identity(
            name="Bob",
            role="member",
            primary_email="bob@example.com",
            emails=["bob@example.com", "bob2@example.com"],
            primary_department_id=dept_id,
            requests_per_day=50,
            is_active=True,
        )
        email_res = _email_response(email_id=email_id, email="bob@example.com")
        artifact = _profile_artifact(profile_id=profile_id)

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([profile_id], 1)),
            _patch("resolve_profile_identity_context", identity),
            _patch("get_profile_artifacts", [artifact]),
        ):
            result = await resolve_profile_by_email(
                None, None, email="bob@example.com"
            )

        assert isinstance(result, ProfileByEmailResult)
        assert result.profile_id == profile_id
        assert result.name == "Bob"
        assert result.role == "member"
        assert result.primary_email == "bob@example.com"
        assert result.emails == ["bob@example.com", "bob2@example.com"]
        assert result.active is True
        assert result.req_per_day == 50
        assert result.primary_department_id == dept_id
        assert result.created_at == NOW
        assert result.updated_at == NOW

    async def test_case_insensitive_email_match(self):
        email_res = _email_response(email="Alice@Example.COM")
        profile_id = uuid4()
        identity = _identity()
        artifact = _profile_artifact(profile_id=profile_id)

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([profile_id], 1)),
            _patch("resolve_profile_identity_context", identity),
            _patch("get_profile_artifacts", [artifact]),
        ):
            result = await resolve_profile_by_email(
                None, None, email="alice@example.com"
            )

        assert result is not None
        assert result.profile_id == profile_id

    async def test_actor_name_resolved_from_actor_profile(self):
        email_res = _email_response(email="target@example.com")
        target_id = uuid4()
        actor_id = uuid4()
        target_identity = _identity(name="Target")
        actor_identity = _identity(name="Actor")
        artifact = _profile_artifact(profile_id=target_id)

        call_count = 0

        async def _mock_identity(conn, pid, redis, bypass_cache=False):
            nonlocal call_count
            call_count += 1
            if pid == target_id:
                return target_identity
            if pid == actor_id:
                return actor_identity
            return None

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([target_id], 1)),
            patch(f"{MODULE}.resolve_profile_identity_context", side_effect=_mock_identity),
            _patch("get_profile_artifacts", [artifact]),
        ):
            result = await resolve_profile_by_email(
                None, None, email="target@example.com", actor_profile_id=actor_id
            )

        assert result is not None
        assert result.actor_name == "Actor"
        assert result.name == "Target"
        assert call_count == 2

    async def test_no_actor_name_when_no_actor_profile(self):
        email_res = _email_response(email="target@example.com")
        profile_id = uuid4()
        identity = _identity(name="Target")
        artifact = _profile_artifact(profile_id=profile_id)

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([profile_id], 1)),
            _patch("resolve_profile_identity_context", identity),
            _patch("get_profile_artifacts", [artifact]),
        ):
            result = await resolve_profile_by_email(
                None, None, email="target@example.com"
            )

        assert result is not None
        assert result.actor_name is None

    async def test_passes_correct_args_to_search_emails(self):
        with (
            _patch("search_emails", []) as mock_search,
        ):
            await resolve_profile_by_email(
                "fake_conn", "fake_redis",
                email="test@example.com",
                bypass_cache=True,
            )

        mock_search.assert_awaited_once_with(
            "fake_conn", "fake_redis",
            search="test@example.com",
            limit_count=100,
            bypass_cache=True,
        )

    async def test_passes_email_ids_to_search_profiles(self):
        email_id = uuid4()
        email_res = _email_response(email_id=email_id, email="x@example.com")

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([], 0)) as mock_search,
        ):
            await resolve_profile_by_email(
                None, None, email="x@example.com"
            )

        mock_search.assert_awaited_once_with(
            None, email_ids=[email_id], active_only=False, limit_count=1
        )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_by_email — not found cases
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveProfileByEmailNotFound:
    async def test_no_email_match_returns_none(self):
        with _patch("search_emails", []):
            result = await resolve_profile_by_email(
                None, None, email="nobody@example.com"
            )
        assert result is None

    async def test_email_substring_match_but_no_exact_returns_none(self):
        # search_emails returns a result but it's not an exact match
        email_res = _email_response(email="alice@example.com.au")

        with _patch("search_emails", [email_res]):
            result = await resolve_profile_by_email(
                None, None, email="alice@example.com"
            )
        assert result is None

    async def test_no_profile_for_email_returns_none(self):
        email_res = _email_response(email="orphan@example.com")

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([], 0)),
        ):
            result = await resolve_profile_by_email(
                None, None, email="orphan@example.com"
            )
        assert result is None

    async def test_profile_identity_not_found_returns_none(self):
        email_res = _email_response(email="broken@example.com")
        profile_id = uuid4()

        with (
            _patch("search_emails", [email_res]),
            _patch("search_profiles", ([profile_id], 1)),
            _patch("resolve_profile_identity_context", None),
        ):
            result = await resolve_profile_by_email(
                None, None, email="broken@example.com"
            )
        assert result is None
