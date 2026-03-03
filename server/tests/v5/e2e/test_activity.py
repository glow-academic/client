"""E2E skeleton: Activity page flow (/analytics/activity → bundle, session list, pagination)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_activity_flow(page: Page, base_url: str) -> None:
    """Activity page: navigate → verify SSR → bundle data → session list → search → pagination."""
    pytest.skip("Skeleton — not yet implemented")

    try:
        # Step 1: Navigate to activity page, wait for load
        page.goto(f"{base_url}/analytics/activity")
        page.wait_for_load_state("networkidle")

        # Step 2: Verify SSR (data-page attribute, key containers visible)
        page_container = page.locator('[data-page="activity-index"]')
        expect(page_container).to_be_visible()

        # Step 3: Verify bundle data renders (problem statements, metrics)
        activity_container = page.get_by_test_id("activity-container")
        activity_container.wait_for(state="visible", timeout=15000)
        expect(activity_container).to_be_visible()

        # Step 4: Verify session list renders with items
        session_list = page.get_by_test_id("activity-session-list")
        if session_list.count() > 0:
            expect(session_list).to_be_visible()

        # Step 5: Test search functionality
        search_input = page.get_by_test_id("activity-search")
        if search_input.count() > 0:
            search_input.fill("test")
            page.wait_for_timeout(500)
            search_input.fill("")
            page.wait_for_timeout(500)

        # Step 6: Test pagination (if enough sessions exist)
        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.count() > 0 and next_button.is_enabled():
            next_button.click()
            page.wait_for_timeout(500)
            prev_button = page.get_by_role("button", name="Go to previous page")
            if prev_button.count() > 0:
                prev_button.click()
                page.wait_for_timeout(500)

    finally:
        pass
