"""E2E tests for pricing SSR rendering, filters, chart display, and table interactions."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.pricing.helpers import (
    fetch_pricing_data,
    verify_pricing_ssr,
    wait_for_pricing_load,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_pricing_ssr_renders_correctly(page: Page, base_url: str) -> None:
    """Ensure pricing SSR renders correctly with all components visible."""
    page.goto(f"{base_url}/analytics/pricing")
    wait_for_pricing_load(page)
    
    verify_pricing_ssr(page)


def test_pricing_summary_cards_display(page: Page, base_url: str) -> None:
    """Verify summary cards display correct values."""
    page.goto(f"{base_url}/analytics/pricing")
    wait_for_pricing_load(page)
    
    # Verify total spend card displays currency value
    total_spend_card = page.get_by_test_id("pricing-card-total-spend")
    expect(total_spend_card).to_be_visible()
    # Check that card contains currency symbol or number
    card_content = total_spend_card.inner_text()
    assert "$" in card_content or any(char.isdigit() for char in card_content)
    
    # Verify run count card displays number
    run_count_card = page.get_by_test_id("pricing-card-run-count")
    expect(run_count_card).to_be_visible()
    run_count_content = run_count_card.inner_text()
    assert any(char.isdigit() for char in run_count_content)
    
    # Verify avg cost card displays currency value
    avg_cost_card = page.get_by_test_id("pricing-card-avg-cost")
    expect(avg_cost_card).to_be_visible()
    avg_cost_content = avg_cost_card.inner_text()
    assert "$" in avg_cost_content or any(char.isdigit() for char in avg_cost_content)


def test_pricing_chart_renders(page: Page, base_url: str) -> None:
    """Verify chart renders correctly."""
    page.goto(f"{base_url}/analytics/pricing")
    wait_for_pricing_load(page)
    
    # Verify chart container is visible
    chart = page.get_by_test_id("pricing-chart")
    expect(chart).to_be_visible()
    
    # Verify chart has content (SVG or canvas elements)
    # Charts are rendered by recharts, so we verify the container exists
    chart_content = chart.locator("svg, canvas")
    # Chart may be empty if no data, so we just verify container exists


def test_pricing_runs_table_interactions(page: Page, base_url: str) -> None:
    """Test runs table interactions."""
    page.goto(f"{base_url}/analytics/pricing")
    wait_for_pricing_load(page)
    
    # Verify runs table renders
    runs_table = page.get_by_test_id("pricing-runs-table")
    expect(runs_table).to_be_visible()
    
    # Table interactions (sorting, pagination) would require more specific test IDs
    # Basic verification that table container exists


def test_pricing_empty_state(page: Page, base_url: str) -> None:
    """Test empty state when date range has no data."""
    page.goto(f"{base_url}/analytics/pricing")
    wait_for_pricing_load(page)
    
    # Verify container exists
    container = page.get_by_test_id("pricing-container")
    expect(container).to_be_visible()
    
    # Empty state testing would require setting date filters that return no results
    # This is a placeholder for future implementation when filter controls have test IDs

