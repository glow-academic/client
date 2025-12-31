"""E2E tests for home page filters (date range, cohort, department)."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.home.helpers import fetch_home_data

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_home_filters_date_range(page: Page, base_url: str) -> None:
    """Test date range filters on home page."""
    page.goto(f"{base_url}/home")
    page.wait_for_load_state("networkidle")

    # Wait for page to load
    simulation_cards = page.locator("[data-testid='simulation-card']")
    simulation_cards.first.wait_for(state="visible", timeout=15000)

    # Get initial count of simulation cards
    initial_count = simulation_cards.count()

    # Note: The home page may not have visible filter controls in the UI
    # Filters might be applied via URL params or server-side only
    # For now, we test that the page loads and displays simulations
    # If filter UI exists, we would test it here

    # Verify simulations are displayed
    if initial_count > 0:
        expect(simulation_cards.first).to_be_visible()

    # Test via API that filters work
    # Get data for last 7 days
    end_date = datetime.now().isoformat()
    start_date = (datetime.now() - timedelta(days=7)).isoformat()

    home_data_7d = fetch_home_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        start_date=start_date,
        end_date=end_date,
        bypass_cache=True,
    )

    assert home_data_7d is not None
    assert "items" in home_data_7d

    # Get data for last 30 days
    start_date_30d = (datetime.now() - timedelta(days=30)).isoformat()

    home_data_30d = fetch_home_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        start_date=start_date_30d,
        end_date=end_date,
        bypass_cache=True,
    )

    assert home_data_30d is not None
    assert "items" in home_data_30d

    # 30-day range should have same or more items than 7-day range
    assert len(home_data_30d.get("items", [])) >= len(home_data_7d.get("items", []))


def test_home_filters_cohort_department(page: Page, base_url: str) -> None:
    """Test cohort and department filters on home page."""
    page.goto(f"{base_url}/home")
    page.wait_for_load_state("networkidle")

    # Wait for page to load
    simulation_cards = page.locator("[data-testid='simulation-card']")
    simulation_cards.first.wait_for(state="visible", timeout=15000)

    # Get baseline data without filters
    home_data_baseline = fetch_home_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    assert home_data_baseline is not None
    baseline_items = home_data_baseline.get("items", [])

    # Test with empty cohort/department filters (should return same as baseline)
    home_data_empty_filters = fetch_home_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        cohort_ids=[],
        department_ids=[],
        bypass_cache=True,
    )

    assert home_data_empty_filters is not None
    # Empty filters should return same results as no filters
    assert len(home_data_empty_filters.get("items", [])) == len(baseline_items)

    # Note: Testing with actual cohort/department IDs would require
    # knowing valid IDs from the test database. This is a basic test
    # that verifies the filter API accepts the parameters correctly.
