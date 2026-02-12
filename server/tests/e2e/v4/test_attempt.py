"""E2E skeleton: Attempt artifact lifecycle (create, get, list, archive, certificate)."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import ADMIN_PROFILE_ID, post_json, resolve_profile_ids

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_attempt_lifecycle(page: Page, base_url: str) -> None:
    """Attempt lifecycle: list attempts → view detail → verify chat history → archive."""
    pytest.skip("Skeleton — not yet implemented")

    request = page.context.request

    try:
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Step 1: Fetch attempt list via API
        attempt_list = post_json(
            request,
            "/api/v4/artifacts/attempt/list",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert attempt_list is not None

        items = attempt_list.get("items", [])
        if not items:
            pytest.skip("No attempts available for testing")

        # Step 2: Get first attempt detail via API
        first_attempt = items[0]
        attempt_id = first_attempt.get("id") or first_attempt.get("attemptId")
        if not attempt_id:
            pytest.skip("No attempt ID found in list data")

        attempt_detail = post_json(
            request,
            "/api/v4/artifacts/attempt/get",
            {"attemptId": attempt_id},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert attempt_detail is not None

        # Step 3: Navigate to attempt page in browser → verify chat renders
        page.goto(f"{base_url}/home/a/{attempt_id}")
        page.wait_for_load_state("networkidle")

        chat_container = page.get_by_test_id("attempt-chat-container")
        chat_container.wait_for(state="visible", timeout=15000)
        expect(chat_container).to_be_visible()

        # Step 4: Verify messages container shows history
        messages_container = page.get_by_test_id("attempt-messages-container")
        messages_container.wait_for(state="visible", timeout=10000)

        # Step 5: Test archive flow (if supported)
        # archive_result = post_json(request, "/api/v4/artifacts/attempt/archive", ...)

        # Step 6: Test certificate flow (if supported)
        # certificate_result = post_json(request, "/api/v4/artifacts/attempt/certificate", ...)

    finally:
        pass
