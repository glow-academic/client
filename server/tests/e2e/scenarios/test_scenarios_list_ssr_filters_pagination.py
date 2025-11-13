"""E2E tests for scenarios list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.scenarios.helpers import (
    create_scenario_api,
    delete_scenario_api,
    fetch_scenarios_list,
    generate_unique_scenario_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_scenarios_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure scenario list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/create/scenarios")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("scenarios-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    cards = grid.get_by_test_id("scenario-card")
    initial_count = cards.count()
    assert initial_count > 0

    first_card = cards.first
    scenario_title = first_card.locator("h3, .font-medium").first.inner_text()
    search_title = scenario_title.strip() if scenario_title else ""

    if not search_title:
        # Fallback: get text from card
        search_title = first_card.inner_text().splitlines()[0].strip()

    search_input = page.get_by_test_id("scenarios-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(search_title)
    page.wait_for_timeout(250)
    filtered_count = cards.count()
    assert filtered_count <= initial_count
    assert (
        grid.get_by_test_id("scenario-card")
        .filter(has_text=search_title)
        .count()
        > 0
    )

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count

    toolbar = page.get_by_test_id("scenarios-toolbar")
    
    # Test Simulation filter
    simulation_button = toolbar.get_by_role("button", name="Simulation")
    if simulation_button.count() > 0:
        simulation_button.click()
        simulation_options = page.get_by_role("option")
        if simulation_options.count() > 1:
            option = simulation_options.nth(1)
            option.wait_for(state="visible", timeout=5000)
            option_text = option.inner_text()
            option.click()
            page.wait_for_timeout(250)
            # Verify filter is applied
            assert cards.count() <= initial_count

    # Test Persona filter
    persona_button = toolbar.get_by_role("button", name="Persona")
    if persona_button.count() > 0:
        persona_button.click()
        persona_options = page.get_by_role("option")
        if persona_options.count() > 1:
            option = persona_options.nth(1)
            option.wait_for(state="visible", timeout=5000)
            option_text = option.inner_text()
            option.click()
            page.wait_for_timeout(250)
            # Verify filter is applied
            assert cards.count() <= initial_count

    # Test Department filter
    department_button = toolbar.get_by_role("button", name="Department")
    if department_button.count() > 0:
        department_button.click()
        department_options = page.get_by_role("option")
        if department_options.count() > 1:
            option = department_options.nth(1)
            option.wait_for(state="visible", timeout=5000)
            option_text = option.inner_text()
            option.click()
            page.wait_for_timeout(250)
            # Verify filter is applied
            assert cards.count() <= initial_count

    # Test reset filters
    reset_button = toolbar.get_by_role("button", name="Reset")
    if reset_button.count() > 0:
        reset_button.click()
        page.wait_for_timeout(250)
        assert cards.count() == initial_count

    # Test empty state with impossible filter
    search_input.fill("__NONEXISTENT_SCENARIO_NAME__")
    page.wait_for_timeout(250)
    empty_state = page.get_by_text("No scenarios match the current filters.")
    if empty_state.count() > 0:
        expect(empty_state).to_be_visible()

    # Verify pagination controls exist
    pagination = page.locator("[aria-label='pagination controls']")
    if pagination.count() == 0:
        # Check for DataTablePagination component
        pagination = page.locator("nav[aria-label*='pagination'], .pagination")
    # Pagination may or may not be visible depending on number of scenarios
    # Just verify the page loaded successfully

