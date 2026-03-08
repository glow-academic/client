"""Tests for infra.auth.decrypt — key decryption via canonical black boxes.

resolve_decrypt is tested with mocked black-box fetchers.
Tests verify: correct arguments flow, error cases, decryption result.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.decrypt import DecryptResult, resolve_decrypt
from app.infra.profile_identity_context import ProfileIdentityContext
from app.routes.v5.tools.resources.keys.types import GetKeyResponse

NOW = datetime.now(UTC)
MODULE = "app.infra.auth.decrypt"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _identity(*, name: str = "Alice") -> ProfileIdentityContext:
    return ProfileIdentityContext(
        profiles_id=uuid4(),
        name=name,
        role="admin",
        role_name="Admin",
        role_description="Administrator",
        role_artifacts=["agent", "persona"],
        primary_email="alice@example.com",
        emails=["alice@example.com"],
        primary_department_id=uuid4(),
        department_ids=[uuid4()],
        settings_id=uuid4(),
        requests_per_day=100,
        is_active=True,
    )


def _key_response(
    *, key_id=None, key="encrypted_value", name="My Key"
) -> GetKeyResponse:
    return GetKeyResponse(
        id=key_id or uuid4(),
        key=key,
        name=name,
        description="test key",
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_decrypt — success
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveDecryptSuccess:
    async def test_returns_decrypt_result(self):
        profile_id = uuid4()
        key_id = uuid4()
        identity = _identity(name="Bob")
        key = _key_response(key_id=key_id, key="enc_secret", name="API Key")

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("get_keys", [key]),
            patch(f"{MODULE}.decrypt_api_key", return_value="decrypted_secret"),
        ):
            result = await resolve_decrypt(
                None, None, profile_id=profile_id, key_id=key_id
            )

        assert isinstance(result, DecryptResult)
        assert result.key == "decrypted_secret"
        assert result.name == "API Key"
        assert result.actor_name == "Bob"

    async def test_passes_correct_args_to_identity(self):
        profile_id = uuid4()
        key_id = uuid4()
        identity = _identity()
        key = _key_response()

        with (
            _patch("resolve_profile_identity_context", identity) as mock_identity,
            _patch("get_keys", [key]),
            patch(f"{MODULE}.decrypt_api_key", return_value="x"),
        ):
            await resolve_decrypt(
                "fake_conn",
                "fake_redis",
                profile_id=profile_id,
                key_id=key_id,
                bypass_cache=True,
            )

        mock_identity.assert_awaited_once_with(
            "fake_conn", profile_id, "fake_redis", bypass_cache=True
        )

    async def test_passes_correct_args_to_get_keys(self):
        profile_id = uuid4()
        key_id = uuid4()
        identity = _identity()
        key = _key_response(key_id=key_id)

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("get_keys", [key]) as mock_keys,
            patch(f"{MODULE}.decrypt_api_key", return_value="x"),
        ):
            await resolve_decrypt(
                "fake_conn",
                "fake_redis",
                profile_id=profile_id,
                key_id=key_id,
                bypass_cache=True,
            )

        mock_keys.assert_awaited_once_with(
            "fake_conn", [key_id], "fake_redis", bypass_cache=True
        )

    async def test_passes_key_value_to_decrypt(self):
        identity = _identity()
        key = _key_response(key="the_encrypted_value")

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("get_keys", [key]),
            patch(f"{MODULE}.decrypt_api_key", return_value="plain") as mock_decrypt,
        ):
            await resolve_decrypt(None, None, profile_id=uuid4(), key_id=uuid4())

        mock_decrypt.assert_called_once_with("the_encrypted_value")


# ═══════════════════════════════════════════════════════════════════════════
# resolve_decrypt — errors
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveDecryptErrors:
    async def test_missing_profile_raises_value_error(self):
        with _patch("resolve_profile_identity_context", None):
            with pytest.raises(ValueError, match="Profile not found"):
                await resolve_decrypt(None, None, profile_id=uuid4(), key_id=uuid4())

    async def test_missing_key_raises_value_error(self):
        identity = _identity()

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("get_keys", []),
        ):
            with pytest.raises(ValueError, match="Key not found"):
                await resolve_decrypt(None, None, profile_id=uuid4(), key_id=uuid4())

    async def test_decrypt_failure_propagates(self):
        identity = _identity()
        key = _key_response()

        with (
            _patch("resolve_profile_identity_context", identity),
            _patch("get_keys", [key]),
            patch(f"{MODULE}.decrypt_api_key", side_effect=ValueError("bad key")),
        ):
            with pytest.raises(ValueError, match="bad key"):
                await resolve_decrypt(None, None, profile_id=uuid4(), key_id=uuid4())
