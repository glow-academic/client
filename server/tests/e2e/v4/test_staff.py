"""E2E skeleton: Staff artifact lifecycle (/management/staff).

Uses profileId instead of entity-specific IDs.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_staff_lifecycle(page: Page, base_url: str) -> None:
    """Staff lifecycle: list → search → detail → edit → verify."""
    pytest.skip("Skeleton — not yet implemented")

    request = page.context.request

    try:
        # Step 1: Navigate to list page → verify table renders
        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")
        staff_table = page.get_by_test_id("staff-table")
        staff_table.wait_for(state="visible", timeout=15000)
        expect(staff_table).to_be_visible()

        # Step 2: Verify rows visible
        rows = staff_table.locator("tbody tr")
        if rows.count() == 0:
            pytest.skip("No staff members available")
        initial_count = rows.count()

        # Step 3: Search → verify filters work
        search_input = page.get_by_test_id("staff-search")
        search_input.fill("admin")
        page.wait_for_timeout(250)
        filtered_count = rows.count()
        assert filtered_count <= initial_count

        # Step 4: Clear search
        search_input.fill("")
        page.wait_for_timeout(250)

        # Step 5: Click first row → navigate to detail
        first_row = rows.first
        first_row.click()
        page.wait_for_load_state("networkidle")

        # Step 6: Verify detail page renders
        # Step 7: Edit a field → submit → verify change

        # Step 8: Navigate back to list
        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")
        expect(staff_table).to_be_visible()

    finally:
        pass
