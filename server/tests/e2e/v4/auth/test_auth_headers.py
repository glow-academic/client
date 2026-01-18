"""E2E tests for auth header validation and security."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

import pytest
from playwright.sync_api import Page
from server.tests.e2e.auth.helpers import fetch_profile_context

from server.tests.e2e.conftest import SECRET

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _build_invalid_headers(
    profile_id: str, effective_profile_id: str, invalid_signature: bool = False
) -> dict[str, str]:
    """Build test headers with optional invalid signature."""
    payload = f"{profile_id}|{effective_profile_id}".encode()
    if invalid_signature:
        # Use wrong secret to create invalid signature
        wrong_secret = "wrong_secret_key"
        signature = hmac.new(
            wrong_secret.encode("utf-8"), payload, hashlib.sha256
        ).digest()
    else:
        signature = hmac.new(SECRET.encode("utf-8"), payload, hashlib.sha256).digest()
    encoded_signature = base64.b64encode(signature).decode("ascii")

    return {
        "X-Test-Profile-Id": profile_id,
        "X-Test-Effective-Profile-Id": effective_profile_id,
        "X-Test-Signature": encoded_signature,
    }


def test_auth_header_validation(page: Page, base_url: str) -> None:
    """Test auth header validation with valid and invalid headers."""
    # Test with valid headers (should work)
    context = fetch_profile_context(
        page.context.request,
        actual_profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        pathname="/home",
        bypass_cache=True,
    )

    assert context is not None, "Valid headers should work"

    # Test with invalid signature via direct API call
    API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")
    invalid_headers = _build_invalid_headers(
        ADMIN_PROFILE_ID, ADMIN_PROFILE_ID, invalid_signature=True
    )
    invalid_headers["Content-Type"] = "application/json"
    invalid_headers["X-Bypass-Cache"] = "1"

    # Make request with invalid signature
    response = page.context.request.post(
        f"{API_BASE}/api/v4/profile/context",
        headers=invalid_headers,
        data='{"actualProfileId": "'
        + ADMIN_PROFILE_ID
        + '", "effectiveProfileId": "'
        + ADMIN_PROFILE_ID
        + '", "pathname": "/home"}',
    )

    # Should fail with 401 or 403
    assert not response.ok, "Invalid signature should cause request to fail"
    assert response.status in [401, 403], f"Expected 401/403, got {response.status}"


def test_auth_header_with_uuid(page: Page, base_url: str) -> None:
    """Test profile context with actual UUID."""
    # Get a guest profile UUID from settings or use default test profile
    from server.tests.e2e.conftest import PROFILE_ID

    context = fetch_profile_context(
        page.context.request,
        actual_profile_id=PROFILE_ID,
        effective_profile_id=PROFILE_ID,
        pathname="/practice",
        bypass_cache=True,
    )

    assert context is not None
    actual_profile = context.get("actualProfile", {})
    effective_profile = context.get("effectiveProfile", {})

    # Both should be valid UUIDs
    import re

    uuid_pattern = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
    )
    assert uuid_pattern.match(actual_profile.get("id", "")), (
        "Profile ID should be valid UUID"
    )
    assert uuid_pattern.match(effective_profile.get("id", "")), (
        "Effective profile ID should be valid UUID"
    )


def test_auth_header_bypass_cache(page: Page, base_url: str) -> None:
    """Test X-Bypass-Cache header behavior."""
    # Make request with bypass cache
    context1 = fetch_profile_context(
        page.context.request,
        actual_profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        pathname="/home",
        bypass_cache=True,
    )

    assert context1 is not None

    # Make another request without bypass cache
    # Note: We can't easily test cache behavior without making multiple requests
    # But we verify the header is accepted
    context2 = fetch_profile_context(
        page.context.request,
        actual_profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        pathname="/home",
        bypass_cache=False,
    )

    assert context2 is not None
    # Both should return data (cache may or may not be hit)
    assert context1.get("effectiveProfile") is not None
    assert context2.get("effectiveProfile") is not None


def test_auth_header_missing_signature(page: Page, base_url: str) -> None:
    """Test that missing signature causes request to fail."""
    API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")

    # Build headers without signature
    headers = {
        "Content-Type": "application/json",
        "X-Bypass-Cache": "1",
        "X-Test-Profile-Id": ADMIN_PROFILE_ID,
        "X-Test-Effective-Profile-Id": ADMIN_PROFILE_ID,
        # Missing X-Test-Signature
    }

    # Make request without signature
    response = page.context.request.post(
        f"{API_BASE}/api/v4/profile/context",
        headers=headers,
        data='{"actualProfileId": "'
        + ADMIN_PROFILE_ID
        + '", "effectiveProfileId": "'
        + ADMIN_PROFILE_ID
        + '", "pathname": "/home"}',
    )

    # Should fail without signature
    assert not response.ok, "Missing signature should cause request to fail"
    assert response.status in [401, 403], f"Expected 401/403, got {response.status}"
