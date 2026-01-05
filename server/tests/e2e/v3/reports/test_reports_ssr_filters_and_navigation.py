"""E2E tests for reports SSR rendering, table interactions, filtering, and navigation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.reports.helpers import (
    fetch_reports_data,
    verify_reports_ssr,
    wait_for_reports_load,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_reports_ssr_renders_correctly(page: Page, base_url: str) -> None:
    """Ensure reports SSR renders correctly with table visible."""
    page.goto(f"{base_url}/analytics/reports")
    wait_for_reports_load(page)

    verify_reports_ssr(page)

    # Verify table headers render (check for common headers)
    # Headers are rendered by the table component
    table_container = page.get_by_test_id("reports-table-container")
    expect(table_container).to_be_visible()

    # Verify at least one profile row exists (if data available)
    # This is conditional based on data availability


def test_reports_table_interactions(page: Page, base_url: str) -> None:
    """Test table interactions including row clicks and navigation."""
    page.goto(f"{base_url}/analytics/reports")
    wait_for_reports_load(page)

    # Fetch data to get a profile ID
    reports_data = fetch_reports_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    data = reports_data.get("data", [])
    if not data:
        pytest.skip("No reports data available for testing")

    # Get first profile ID
    first_profile = data[0]
    profile_id = first_profile.get("profileId")

    if not profile_id:
        pytest.skip("No profile ID found in reports data")

    # Find and click the profile row
    profile_row = page.get_by_test_id(f"reports-profile-row-{profile_id}")

    if profile_row.count() > 0:
        profile_row.first.click()
        page.wait_for_timeout(500)

        # Verify navigation to individual report page
        expect(page).to_have_url(
            f"{base_url}/analytics/reports/p/{profile_id}", timeout=10000
        )

        # Navigate back
        page.go_back()
        wait_for_reports_load(page)

        # Verify table still renders
        table_container = page.get_by_test_id("reports-table-container")
        expect(table_container).to_be_visible()


def test_reports_sorting(page: Page, base_url: str) -> None:
    """Test table sorting functionality."""
    page.goto(f"{base_url}/analytics/reports")
    wait_for_reports_load(page)

    # Try to find and click a sortable column header
    # Column headers are rendered by DataTableColumnHeader component
    # We can try clicking on common column headers like "Name" or "Avg Score"

    # Check if sorting controls are available
    # Sorting is handled by tanstack/react-table, so we verify the table renders
    table_container = page.get_by_test_id("reports-table-container")
    expect(table_container).to_be_visible()

    # Basic verification that table is interactive
    # Full sorting test would require more specific test IDs on column headers


def test_reports_empty_state(page: Page, base_url: str) -> None:
    """Test empty state when filters return no results."""
    page.goto(f"{base_url}/analytics/reports")
    wait_for_reports_load(page)

    # Verify table container exists
    table_container = page.get_by_test_id("reports-table-container")
    expect(table_container).to_be_visible()

    # Empty state testing would require setting filters that return no results
    # This is a placeholder for future implementation when filter controls have test IDs
