"""E2E skeleton: Leaderboard page flow (/leaderboard → accolades, table)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_leaderboard_flow(page: Page, base_url: str) -> None:
    """Leaderboard page: navigate → verify SSR → accolade cards → table interactions → navigation."""
    pytest.skip("Skeleton — not yet implemented")

    try:
        # Step 1: Navigate to leaderboard page, wait for load
        page.goto(f"{base_url}/analytics/leaderboard")
        page.wait_for_load_state("networkidle")

        # Step 2: Verify SSR (key containers visible)
        container = page.get_by_test_id("leaderboard-container")
        container.wait_for(state="visible", timeout=15000)
        expect(container).to_be_visible()

        # Step 3: Verify accolade cards render
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

        visible_accolades = []
        for key in accolade_keys:
            accolade_card = page.get_by_test_id(f"accolade-{key}")
            if accolade_card.count() > 0:
                visible_accolades.append(key)

        # Step 4: Test accolade modal interactions
        for key in visible_accolades[:1]:
            accolade_card = page.get_by_test_id(f"accolade-{key}")
            if accolade_card.first.is_visible():
                accolade_card.first.click()
                page.wait_for_timeout(500)
                modal = page.locator('[role="dialog"]')
                if modal.count() > 0:
                    expect(modal.first).to_be_visible()
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(500)

        # Step 5: Verify table renders and test row click
        table = page.get_by_test_id("leaderboard-table")
        if table.count() > 0:
            expect(table).to_be_visible()

    finally:
        pass
