"""E2E skeleton: Dashboard page flow (/analytics/dashboard → carousels, metrics)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import ADMIN_PROFILE_ID

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_dashboard_flow(page: Page, base_url: str) -> None:
    """Dashboard page: navigate → verify SSR → metrics cards → carousel navigation."""
    pytest.skip("Skeleton — not yet implemented")

    try:
        # Step 1: Navigate to dashboard page, wait for load
        page.goto(f"{base_url}/analytics/dashboard")
        page.wait_for_load_state("networkidle")

        # Step 2: Verify SSR (data-page attribute, key containers visible)
        page_container = page.locator('[data-page="dashboard-index"]')
        expect(page_container).to_be_visible()

        container = page.get_by_test_id("dashboard-container")
        container.wait_for(state="visible", timeout=15000)
        expect(container).to_be_visible()

        # Step 3: Verify data sections render (metrics cards, charts)

        # Step 4: Test carousel navigation (header, primary, secondary, footer sections)
        carousel_sections = [
            "dashboard-header-carousel",
            "dashboard-primary-carousel",
            "dashboard-secondary-carousel",
            "dashboard-left-footer-carousel",
            "dashboard-right-footer-carousel",
        ]

        for section in carousel_sections:
            next_btn = page.get_by_test_id(f"{section}-next")
            prev_btn = page.get_by_test_id(f"{section}-prev")

            if next_btn.is_visible():
                next_btn.click()
                page.wait_for_timeout(500)
                expect(prev_btn).to_be_visible()
                prev_btn.click()
                page.wait_for_timeout(500)

    finally:
        pass
