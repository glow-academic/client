"""E2E tests for creating scenarios with validation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.scenarios.helpers import (
    delete_scenario_api,
    generate_unique_scenario_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message)
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        toast = page.get_by_text(message, exact=False)
        toast.wait_for(state="visible", timeout=5000)
    expect(toast).to_be_visible()


def test_scenario_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create a scenario successfully."""
    page.goto(f"{base_url}/create/scenarios/new")
    page.wait_for_load_state("networkidle")

    # Verify page attribute
    page_container = page.locator("[data-page='scenario-new']")
    expect(page_container).to_be_visible()

    title_input = page.get_by_test_id("input-scenario-title")
    title_input.wait_for(state="visible", timeout=20000)

    submit_button = page.get_by_test_id("btn-submit-scenario")

    # Fill out required fields
    scenario_name = generate_unique_scenario_name()
    title_input.fill(scenario_name)

    problem_statement_input = page.get_by_test_id("input-scenario-problem-statement")
    problem_statement_input.wait_for(state="visible", timeout=20000)
    problem_statement_input.fill("Scenario created via E2E test.")

    # Toggle switches
    active_switch = page.get_by_test_id("switch-scenario-active")
    if active_switch.count() > 0:
        active_switch.click()

    hints_switch = page.get_by_test_id("switch-scenario-hints")
    if hints_switch.count() > 0:
        hints_switch.click()

    objectives_switch = page.get_by_test_id("switch-scenario-objectives")
    if objectives_switch.count() > 0:
        objectives_switch.click()

    copy_paste_switch = page.get_by_test_id("switch-scenario-copy-paste")
    if copy_paste_switch.count() > 0:
        copy_paste_switch.click()

    input_guardrail_switch = page.get_by_test_id("switch-scenario-input-guardrail")
    if input_guardrail_switch.count() > 0:
        input_guardrail_switch.click()

    output_guardrail_switch = page.get_by_test_id("switch-scenario-output-guardrail")
    if output_guardrail_switch.count() > 0:
        output_guardrail_switch.click()

    submit_button.click()

    page.wait_for_url(f"{base_url}/create/scenarios", timeout=20000)
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("scenarios-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(scenario_name)
    page.wait_for_timeout(250)

    scenario_card = (
        page.get_by_test_id("scenario-card").filter(has_text=scenario_name).first
    )
    expect(scenario_card).to_be_visible()

    # Cleanup: delete created scenario
    scenario_id = scenario_card.get_attribute("data-scenario-id")
    if scenario_id:
        delete_button = scenario_card.get_by_test_id("btn-delete-scenario")
        if delete_button.count() > 0:
            delete_button.click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            expect(confirm_button).to_be_enabled()
            confirm_button.click()
            page.wait_for_timeout(500)
            expect(
                page.get_by_test_id("scenario-card").filter(has_text=scenario_name)
            ).to_have_count(0)
        else:
            # Fallback: delete via API
            delete_scenario_api(page.context.request, scenario_id)
