"""E2E skeleton: Reports page flow (/analytics/reports → table, navigation)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import ADMIN_PROFILE_ID, post_json, resolve_profile_ids

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_reports_flow(page: Page, base_url: str) -> None:
    """Reports page: navigate → verify SSR → table → row click → profile report → back."""
    pytest.skip("Skeleton — not yet implemented")

    request = page.context.request

    try:
        # Step 1: Navigate to reports page, wait for load
        page.goto(f"{base_url}/analytics/reports")
        page.wait_for_load_state("networkidle")

        # Step 2: Verify SSR (key containers visible)
        table_container = page.get_by_test_id("reports-table-container")
        table_container.wait_for(state="visible", timeout=15000)
        expect(table_container).to_be_visible()

        # Step 3: Fetch data via API to get a profile ID for row click
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Step 4: Click on a profile row → navigate to individual report
        # Step 5: Verify sub-page renders, navigate back

    finally:
        pass
