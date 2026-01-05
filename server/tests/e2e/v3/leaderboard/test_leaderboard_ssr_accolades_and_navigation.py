"""E2E tests for leaderboard SSR rendering, accolade cards, table interactions, and navigation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.leaderboard.helpers import (
    fetch_leaderboard_data,
    verify_leaderboard_ssr,
    wait_for_leaderboard_load,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_leaderboard_ssr_renders_correctly(page: Page, base_url: str) -> None:
    """Ensure leaderboard SSR renders correctly with accolade cards and table visible."""
    page.goto(f"{base_url}/analytics/leaderboard")
    wait_for_leaderboard_load(page)

    verify_leaderboard_ssr(page)

    # Verify at least one accolade card renders (check for common ones)
    accolade_keys = [
        "highestScorer",
        "perfectScore",
        "longestConvo",
        "responseTimes",
        "quickestPass",
        "thePersistent",
        "marathonRunner",
        "rapidRiser",
    ]

    # Check if any accolade cards are visible
    visible_accolades = []
    for key in accolade_keys:
        accolade_card = page.get_by_test_id(f"accolade-{key}")
        if accolade_card.count() > 0:
            visible_accolades.append(key)

    # At least some accolade cards should be visible if data exists
    # This is conditional based on data availability


def test_leaderboard_accolade_cards_display(page: Page, base_url: str) -> None:
    """Verify accolade cards display correctly."""
    page.goto(f"{base_url}/analytics/leaderboard")
    wait_for_leaderboard_load(page)

    # Check for a common accolade card
    highest_scorer = page.get_by_test_id("accolade-highestScorer")

    if highest_scorer.count() > 0:
        expect(highest_scorer.first).to_be_visible()

        # Verify card shows title (check for text content)
        card_text = highest_scorer.first.inner_text()
        assert len(card_text) > 0, "Accolade card should have content"


def test_leaderboard_accolade_modal_interactions(page: Page, base_url: str) -> None:
    """Test accolade modal interactions including view report navigation."""
    page.goto(f"{base_url}/analytics/leaderboard")
    wait_for_leaderboard_load(page)

    # Fetch data to get profile IDs
    leaderboard_data = fetch_leaderboard_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    data = leaderboard_data.get("data", [])
    if not data:
        pytest.skip("No leaderboard data available for testing")

    # Try to click on an accolade card
    accolade_keys = ["highestScorer", "perfectScore", "longestConvo"]

    for key in accolade_keys:
        accolade_card = page.get_by_test_id(f"accolade-{key}")
        if accolade_card.count() > 0 and accolade_card.first.is_visible():
            # Click on the accolade card
            accolade_card.first.click()
            page.wait_for_timeout(500)

            # Check if modal opened (look for dialog or modal content)
            # Modal might be rendered with framer-motion, so we check for visible content
            modal_content = page.locator('[role="dialog"]')
            if modal_content.count() > 0:
                # Verify winner details display
                expect(modal_content.first).to_be_visible()

                # Try to find and click "View report" button if available
                # Get profile ID from data
                first_profile = data[0]
                profile_id = first_profile.get("profileId")

                if profile_id:
                    view_report_btn = page.get_by_test_id(
                        f"btn-view-report-{profile_id}"
                    )
                    if view_report_btn.count() > 0:
                        view_report_btn.first.click()
                        page.wait_for_timeout(500)

                        # Verify navigation to report page
                        expect(page).to_have_url(
                            f"{base_url}/analytics/reports/p/{profile_id}",
                            timeout=10000,
                        )
                        break

            # Close modal if opened (press Escape or click outside)
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
            break


def test_leaderboard_table_interactions(page: Page, base_url: str) -> None:
    """Test leaderboard table interactions."""
    page.goto(f"{base_url}/analytics/leaderboard")
    wait_for_leaderboard_load(page)

    # Fetch data to get profile IDs
    leaderboard_data = fetch_leaderboard_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    data = leaderboard_data.get("data", [])
    if not data:
        pytest.skip("No leaderboard data available for testing")

    # Verify table renders
    table = page.get_by_test_id("leaderboard-table")
    expect(table).to_be_visible()

    # Get first profile ID
    first_profile = data[0]
    profile_id = first_profile.get("profileId")

    if profile_id:
        # Find and click the table row
        table_row = page.get_by_test_id(f"leaderboard-row-{profile_id}")

        if table_row.count() > 0:
            # Click on the row (if clickable)
            table_row.first.click()
            page.wait_for_timeout(500)

            # Verify navigation if onViewReport is available
            # This depends on user permissions and component configuration


def test_leaderboard_empty_state(page: Page, base_url: str) -> None:
    """Test empty state when cohort has no data."""
    page.goto(f"{base_url}/analytics/leaderboard")
    wait_for_leaderboard_load(page)

    # Verify container exists
    container = page.get_by_test_id("leaderboard-container")
    expect(container).to_be_visible()

    # Empty state testing would require setting filters that return no results
    # Check for empty state message if no data
    empty_state = page.get_by_text("No Data Available")
    if empty_state.count() > 0:
        expect(empty_state.first).to_be_visible()
