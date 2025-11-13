"""E2E tests for editing and updating scenarios."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.scenarios.helpers import (
    create_scenario_api,
    delete_scenario_api,
    generate_unique_scenario_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_scenario_edit_update_fields(page: Page, base_url: str) -> None:
    """Test editing a scenario and updating fields."""
    # Create scenario via API
    scenario_name = generate_unique_scenario_name("Edit Test")
    scenario_id = create_scenario_api(
        page.context.request,
        name=scenario_name,
        problem_statement="Original problem statement",
    )

    try:
        # Navigate to scenarios list
        page.goto(f"{base_url}/create/scenarios")
        page.wait_for_load_state("networkidle")

        # Search for scenario
        search_input = page.get_by_test_id("scenarios-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(scenario_name)
        page.wait_for_timeout(250)

        scenario_card = page.locator(
            f"[data-testid='scenario-card'][data-scenario-id='{scenario_id}']"
        )
        expect(scenario_card).to_be_visible()

        # Click edit button
        edit_button = scenario_card.get_by_test_id("btn-edit-scenario")
        expect(edit_button).to_be_enabled()
        edit_button.click()

        page.wait_for_url(f"{base_url}/create/scenarios/s/{scenario_id}")
        page.wait_for_load_state("networkidle")

        # Verify page attributes
        page_container = page.locator(f"[data-page='scenario-edit'][data-scenario-id='{scenario_id}']")
        expect(page_container).to_be_visible()

        # Verify form fields are pre-populated
        title_input = page.get_by_test_id("input-scenario-title")
        title_input.wait_for(state="visible", timeout=15000)
        expect(title_input).to_have_value(scenario_name)

        problem_statement_input = page.get_by_test_id("input-scenario-problem-statement")
        problem_statement_input.wait_for(state="visible", timeout=15000)
        expect(problem_statement_input).to_have_value("Original problem statement")

        # Update fields
        new_name = f"{scenario_name} Updated"
        title_input.fill(new_name)

        new_problem_statement = "Updated problem statement via E2E test"
        problem_statement_input.fill(new_problem_statement)

        # Toggle a switch
        hints_switch = page.get_by_test_id("switch-scenario-hints")
        if hints_switch.count() > 0:
            hints_switch.click()

        # Submit update
        submit_button = page.get_by_test_id("btn-submit-scenario")
        submit_button.click()

        # Wait for redirect back to list
        page.wait_for_url(f"{base_url}/create/scenarios", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Verify changes persist
        search_input = page.get_by_test_id("scenarios-search")
        search_input.fill(new_name)
        page.wait_for_timeout(250)

        updated_card = page.get_by_test_id("scenario-card").filter(has_text=new_name).first
        expect(updated_card).to_be_visible()

    finally:
        # Cleanup
        delete_scenario_api(page.context.request, scenario_id)

