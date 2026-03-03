"""E2E skeleton: Login and authentication flows."""

from __future__ import annotations

import base64
import hashlib
import hmac
import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.conftest import SECRET
from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
    API_BASE,
    post_json,
)

pytestmark = pytest.mark.e2e


def _build_invalid_headers(
    profile_id: str, effective_profile_id: str, *, invalid_signature: bool = False
) -> dict[str, str]:
    """Build test headers with optional invalid signature."""
    payload = f"{profile_id}|{effective_profile_id}".encode()
    if invalid_signature:
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


def test_login_flows(page: Page, base_url: str) -> None:
    """Auth flows: valid headers → invalid HMAC → missing signature → guest login → emulation → role access."""
    pytest.skip("Skeleton — not yet implemented")

    request = page.context.request

    try:
        # Step 1: Valid headers → profile context returns success
        context_data = post_json(
            request,
            "/api/v5/profile/context",
            {
                "actualProfileId": ADMIN_PROFILE_ID,
                "effectiveProfileId": ADMIN_PROFILE_ID,
                "pathname": "/home",
            },
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        assert context_data is not None
        assert context_data.get("effectiveProfile") is not None

        # Step 2: Invalid HMAC signature → 401/403
        invalid_headers = _build_invalid_headers(
            ADMIN_PROFILE_ID, ADMIN_PROFILE_ID, invalid_signature=True
        )
        invalid_headers["Content-Type"] = "application/json"
        invalid_headers["X-Bypass-Cache"] = "1"

        response = request.post(
            f"{API_BASE}/api/v5/profile/context",
            headers=invalid_headers,
            data='{"actualProfileId": "'
            + ADMIN_PROFILE_ID
            + '", "effectiveProfileId": "'
            + ADMIN_PROFILE_ID
            + '", "pathname": "/home"}',
        )
        assert not response.ok
        assert response.status in [401, 403]

        # Step 3: Missing signature → 401/403
        missing_sig_headers = {
            "Content-Type": "application/json",
            "X-Bypass-Cache": "1",
            "X-Test-Profile-Id": ADMIN_PROFILE_ID,
            "X-Test-Effective-Profile-Id": ADMIN_PROFILE_ID,
        }
        response = request.post(
            f"{API_BASE}/api/v5/profile/context",
            headers=missing_sig_headers,
            data='{"actualProfileId": "'
            + ADMIN_PROFILE_ID
            + '", "effectiveProfileId": "'
            + ADMIN_PROFILE_ID
            + '", "pathname": "/home"}',
        )
        assert not response.ok
        assert response.status in [401, 403]

        # Step 4: Guest login → can access /practice, not /management
        # (Would need a separate page fixture with guest profile headers)

        # Step 5: Profile emulation → self-emulation works
        emulation_result = post_json(
            request,
            "/api/v5/profile/emulate",
            {
                "requesterProfileId": ADMIN_PROFILE_ID,
                "targetProfileId": ADMIN_PROFILE_ID,
            },
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        assert emulation_result.get("allowed") is True

        # Step 6: Role-based access → admin sees management pages
        page.goto(f"{base_url}/management/profiles")
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r".*/management/profiles.*"))
        profiles_table = page.get_by_test_id("profiles-table")
        profiles_table.wait_for(state="visible", timeout=15000)
        expect(profiles_table).to_be_visible()

    finally:
        pass
