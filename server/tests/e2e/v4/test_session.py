"""E2E skeleton: Session artifact lifecycle (get, list — used by activity page)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
    post_json,
    resolve_profile_ids,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_session_lifecycle(page: Page, base_url: str) -> None:
    """Session lifecycle: list sessions via API → get detail → verify on activity page."""
    pytest.skip("Skeleton — not yet implemented")

    request = page.context.request

    try:
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Step 1: Fetch session list via API (paginated)
        session_list = post_json(
            request,
            "/api/v4/artifacts/session/list",
            {"page_limit": 10, "page_offset": 0},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert session_list is not None

        items = session_list.get("items", [])
        if not items:
            pytest.skip("No sessions available for testing")

        # Step 2: Get first session detail via API
        first_session = items[0]
        session_id = first_session.get("id") or first_session.get("sessionId")
        if not session_id:
            pytest.skip("No session ID found in list data")

        session_detail = post_json(
            request,
            "/api/v4/artifacts/session/get",
            {"sessionId": session_id},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert session_detail is not None

        # Step 3: Verify session data on activity page
        page.goto(f"{base_url}/analytics/activity")
        page.wait_for_load_state("networkidle")

        activity_container = page.get_by_test_id("activity-container")
        activity_container.wait_for(state="visible", timeout=15000)
        expect(activity_container).to_be_visible()

        # Step 4: Test search within session list
        search_input = page.get_by_test_id("activity-search")
        if search_input.count() > 0:
            search_input.fill("test")
            page.wait_for_timeout(500)
            search_input.fill("")
            page.wait_for_timeout(500)

    finally:
        pass
