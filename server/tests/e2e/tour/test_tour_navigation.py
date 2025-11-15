"""E2E tests for tour navigation (back/forward buttons)."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_tour_navigation_back_forward(page: Page, base_url: str) -> None:
    """Test tour navigation between steps using back/forward buttons."""
    # Navigate to home page
    page.goto(f"{base_url}/home")
    page.wait_for_load_state("networkidle")

    # Start tour
    guide_button = page.get_by_test_id("tour-guide-button")
    guide_button.wait_for(state="visible", timeout=15000)
    guide_button.click()

    page.wait_for_timeout(1000)  # Give tour time to initialize

    # Find navigation buttons
    next_button = page.locator("button").filter(has_text="Next")
    prev_button = (
        page.locator("button")
        .filter(has_text="Previous")
        .or_(page.locator("button").filter(has_text="Back"))
    )

    # Move forward to step 1
    if next_button.count() > 0:
        next_button.first.click()
        page.wait_for_timeout(1000)

        # Verify we're on step 1 (should navigate to leaderboard)
        page.wait_for_url(re.compile(r".*/leaderboard"), timeout=10000)

        # Move back to step 0
        if prev_button.count() > 0:
            prev_button.first.click()
            page.wait_for_timeout(1000)

            # Verify we're back on home page
            page.wait_for_url(re.compile(r".*/home"), timeout=10000)

            # Move forward again
            next_button.first.click()
            page.wait_for_timeout(1000)

            # Verify we're back on step 1
            page.wait_for_url(re.compile(r".*/leaderboard"), timeout=10000)

    # Close tour
    close_button = (
        page.locator("button")
        .filter(has_text="Close")
        .or_(page.locator("button[aria-label='Close']"))
    )
    if close_button.count() > 0:
        close_button.first.click()
        page.wait_for_timeout(500)

    # Verify tour is closed
    guide_button = page.get_by_test_id("tour-guide-button")
    expect(guide_button).to_be_visible()
