"""E2E test validating read-only scenario guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.scenarios.helpers import fetch_scenarios_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_scenario_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only scenarios hide editing controls and disable inputs."""
    data = fetch_scenarios_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    scenarios = data.get("scenarios", [])
    readonly_scenario = next(
        (s for s in scenarios if not s.get("can_edit") and s.get("scenario_id")), None
    )
    if not readonly_scenario:
        pytest.skip("No read-only scenario available in current dataset")

    scenario_id = readonly_scenario["scenario_id"]
    scenario_title = readonly_scenario.get("title") or readonly_scenario.get("name") or ""

    page.goto(f"{base_url}/create/scenarios")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("scenarios-search")
    search_input.wait_for(state="visible", timeout=10000)
    if scenario_title:
        search_input.fill(scenario_title)
        page.wait_for_timeout(250)

    scenario_card = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{scenario_id}']"
    )
    expect(scenario_card).to_be_visible()

    expect(scenario_card.get_by_test_id("btn-edit-scenario")).to_have_count(0)
    view_button = scenario_card.get_by_test_id("btn-view-scenario")
    expect(view_button).to_be_visible()

    view_button.click()

    page.wait_for_url(f"{base_url}/create/scenarios/s/{scenario_id}")
    page.wait_for_load_state("networkidle")

    # Verify page attributes
    page_container = page.locator(f"[data-page='scenario-edit'][data-scenario-id='{scenario_id}']")
    expect(page_container).to_be_visible()

    # Verify form inputs are disabled
    title_input = page.get_by_test_id("input-scenario-title")
    expect(title_input).to_be_disabled()

    problem_statement_input = page.get_by_test_id("input-scenario-problem-statement")
    expect(problem_statement_input).to_be_disabled()

    # Verify switches are disabled
    active_switch = page.get_by_test_id("switch-scenario-active")
    if active_switch.count() > 0:
        expect(active_switch).to_be_disabled()

    hints_switch = page.get_by_test_id("switch-scenario-hints")
    if hints_switch.count() > 0:
        expect(hints_switch).to_be_disabled()

    # Verify submit button is disabled
    submit_button = page.get_by_test_id("btn-submit-scenario")
    expect(submit_button).to_be_disabled()

