"""Reusable UI flow functions for scenario E2E tests."""

from __future__ import annotations

import re
import sys

from playwright.sync_api import Page, expect

from server.tests.e2e.scenarios.helpers import generate_unique_scenario_name


def create_scenario_via_ui(
    page: Page,
    base_url: str,
    *,
    name: str | None = None,
    problem_statement: str = "Scenario created via UI flow.",
) -> tuple[str, str]:
    """Create a scenario via UI and return (scenario_name, scenario_id)."""
    scenario_name = name or generate_unique_scenario_name("UI Scenario")

    page.goto(f"{base_url}/create/scenarios/new")
    page.wait_for_load_state("networkidle")

    title_input = page.get_by_test_id("input-scenario-title")
    title_input.wait_for(state="visible", timeout=15000)
    title_input.fill(scenario_name)

    problem_statement_textarea = page.get_by_test_id("input-scenario-problem-statement")
    problem_statement_textarea.wait_for(state="visible", timeout=15000)
    problem_statement_textarea.fill(problem_statement)

    submit_button = page.get_by_test_id("btn-submit-scenario")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/create/scenarios.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after scenario create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='scenarios-grid']", timeout=10000)

    search_input = page.get_by_test_id("scenarios-search")
    search_input.fill(scenario_name)
    page.wait_for_timeout(500)

    scenario_card = (
        page.get_by_test_id("scenario-card").filter(has_text=scenario_name).first
    )
    expect(scenario_card).to_be_visible()

    scenario_id = scenario_card.get_attribute("data-scenario-id")
    if not scenario_id:
        raise AssertionError("Created scenario card missing data-scenario-id attribute")

    return scenario_name, scenario_id
