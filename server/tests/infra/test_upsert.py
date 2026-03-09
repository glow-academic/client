"""Tests for infra.auth.upsert — profile upsert via canonical black boxes.

resolve_profile_upsert is tested with mocked black-box fetchers.
Tests verify: create vs update path, role validation, resource resolution, session creation.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.upsert import UpsertProfileResult, resolve_profile_upsert

MODULE = "app.infra.auth.upsert"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


def _name_resource(*, id=None, name="Test"):
    m = MagicMock()
    m.id = id or uuid4()
    m.name = name
    return m


def _email_resource(*, id=None, email="test@example.com"):
    m = MagicMock()
    m.id = id or uuid4()
    m.email = email
    return m


def _role_resource(*, id=None, role="member"):
    m = MagicMock()
    m.id = id or uuid4()
    m.role = role
    m.name = role
    return m


def _flag_resource(*, id=None, name="profile_active"):
    m = MagicMock()
    m.id = id or uuid4()
    m.name = name
    return m


def _identity(*, role="superadmin"):
    m = MagicMock()
    m.role = role
    m.profiles_id = uuid4()
    return m


def _create_result(*, id=None):
    m = MagicMock()
    m.id = id or uuid4()
    return m


def _session_result(*, id=None):
    m = MagicMock()
    m.id = id or uuid4()
    return m


# ── Standard mock context ────────────────────────────────────────────────────


def _standard_mocks(
    *,
    existing_profile_ids=None,
    role_str="member",
    requester_role="superadmin",
):
    """Build standard mock set for a typical upsert flow."""
    name_id = uuid4()
    email_id = uuid4()
    role_id = uuid4()
    flag_id = uuid4()
    profile_id = uuid4()
    profiles_resource_id = uuid4()
    session_id = uuid4()

    return {
        "name_id": name_id,
        "email_id": email_id,
        "role_id": role_id,
        "flag_id": flag_id,
        "profile_id": profile_id,
        "profiles_resource_id": profiles_resource_id,
        "session_id": session_id,
        "patches": (
            _patch("resolve_profile_identity_context", _identity(role=requester_role)),
            _patch("create_name", _name_resource(id=name_id)),
            _patch("create_email", _email_resource(id=email_id)),
            _patch(
                "search_roles",
                [_role_resource(id=role_id, role=role_str)],
            ),
            _patch("search_flags", [_flag_resource(id=flag_id)]),
            _patch(
                "search_profiles",
                (existing_profile_ids or [], len(existing_profile_ids or [])),
            ),
            _patch("create_denormalized_snapshot", profiles_resource_id),
            _patch("create_profile_artifact", _create_result(id=profile_id)),
            _patch("update_profile_artifact", _create_result(id=profile_id)),
            _patch("create_session", _session_result(id=session_id)),
        ),
    }


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_upsert — create path
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUpsertCreatePath:
    async def test_creates_new_profile(self):
        mocks = _standard_mocks(existing_profile_ids=[])

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7],
            mocks["patches"][8],
            mocks["patches"][9],
        ):
            result = await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="John Doe",
                emails=["john@example.com"],
                role="member",
                current_profile_id=uuid4(),
            )

        assert isinstance(result, UpsertProfileResult)
        assert result.created is True
        assert result.profile_id == mocks["profile_id"]
        assert result.session_id == mocks["session_id"]

    async def test_passes_correct_args_to_create_profile(self):
        mocks = _standard_mocks(existing_profile_ids=[])

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7] as mock_create,
            mocks["patches"][8],
            mocks["patches"][9],
        ):
            dept_id = uuid4()
            await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="Jane",
                emails=["jane@example.com"],
                role="member",
                department_ids=[dept_id],
                current_profile_id=uuid4(),
            )

        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["name_id"] == mocks["name_id"]
        assert call_kwargs["email_ids"] == [mocks["email_id"]]
        assert call_kwargs["role_ids"] == [mocks["role_id"]]
        assert call_kwargs["department_ids"] == [dept_id]
        assert call_kwargs["profile_ids"] == [mocks["profiles_resource_id"]]

    async def test_creates_session_with_profiles_resource_id(self):
        mocks = _standard_mocks(existing_profile_ids=[])

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7],
            mocks["patches"][8],
            mocks["patches"][9] as mock_session,
        ):
            await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="John",
                emails=["john@example.com"],
                role="member",
                current_profile_id=uuid4(),
            )

        mock_session.assert_called_once_with(None, mocks["profiles_resource_id"])


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_upsert — update path
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUpsertUpdatePath:
    async def test_updates_existing_profile(self):
        existing_id = uuid4()
        mocks = _standard_mocks(existing_profile_ids=[existing_id])

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7],
            mocks["patches"][8],
            mocks["patches"][9],
        ):
            result = await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="Updated Name",
                emails=["existing@example.com"],
                role="member",
                current_profile_id=uuid4(),
            )

        assert result.created is False
        assert result.profile_id == existing_id

    async def test_calls_update_not_create(self):
        existing_id = uuid4()
        mocks = _standard_mocks(existing_profile_ids=[existing_id])

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7] as mock_create,
            mocks["patches"][8] as mock_update,
            mocks["patches"][9],
        ):
            await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="Updated",
                emails=["existing@example.com"],
                role="member",
                current_profile_id=uuid4(),
            )

        mock_create.assert_not_called()
        mock_update.assert_called_once()


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_upsert — role validation
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUpsertRoleValidation:
    async def test_admin_cannot_assign_superadmin(self):
        mocks = _standard_mocks(
            existing_profile_ids=[],
            role_str="superadmin",
            requester_role="admin",
        )

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7],
            mocks["patches"][8],
            mocks["patches"][9],
        ):
            with pytest.raises(ValueError, match="cannot assign role"):
                await resolve_profile_upsert(
                    None,
                    AsyncMock(),
                    name="Test",
                    emails=["test@example.com"],
                    role="superadmin",
                    current_profile_id=uuid4(),
                )

    async def test_no_current_profile_skips_validation(self):
        mocks = _standard_mocks(existing_profile_ids=[])

        with (
            mocks["patches"][0],
            mocks["patches"][1],
            mocks["patches"][2],
            mocks["patches"][3],
            mocks["patches"][4],
            mocks["patches"][5],
            mocks["patches"][6],
            mocks["patches"][7],
            mocks["patches"][8],
            mocks["patches"][9],
        ):
            result = await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="Test",
                emails=["test@example.com"],
                role="member",
                current_profile_id=None,
            )

        assert result.created is True

    async def test_role_not_found_raises(self):
        with (
            _patch("resolve_profile_identity_context", None),
            _patch("create_name", _name_resource()),
            _patch("create_email", _email_resource()),
            _patch("search_roles", []),
            _patch("search_flags", []),
        ):
            with pytest.raises(ValueError, match="Role.*not found"):
                await resolve_profile_upsert(
                    None,
                    AsyncMock(),
                    name="Test",
                    emails=["test@example.com"],
                    role="nonexistent",
                )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_upsert — multiple emails
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUpsertMultipleEmails:
    async def test_creates_all_email_resources(self):
        email_ids = [uuid4(), uuid4(), uuid4()]
        call_count = 0

        async def mock_create_email(conn, email, redis):
            nonlocal call_count
            result = _email_resource(id=email_ids[call_count])
            call_count += 1
            return result

        with (
            _patch("resolve_profile_identity_context", None),
            patch(f"{MODULE}.create_email", side_effect=mock_create_email),
            _patch("create_name", _name_resource()),
            _patch("search_roles", [_role_resource()]),
            _patch("search_flags", [_flag_resource()]),
            _patch("search_profiles", ([], 0)),
            _patch("create_denormalized_snapshot", uuid4()),
            _patch("create_profile_artifact", _create_result()) as mock_create,
            _patch("create_session", _session_result()),
        ):
            await resolve_profile_upsert(
                None,
                AsyncMock(),
                name="Multi Email",
                emails=["a@test.com", "b@test.com", "c@test.com"],
                role="member",
            )

        assert call_count == 3
        call_kwargs = mock_create.call_args[1]
        assert call_kwargs["email_ids"] == email_ids
