"""UI flow helpers for simulation E2E tests."""

from __future__ import annotations

import re
import sys

from playwright.sync_api import Page, expect

from server.tests.e2e.simulations.helpers import generate_unique_simulation_name


def create_simulation_via_ui(
    page: Page,
    base_url: str,
    *,
    name: str | None = None,
    description: str = "Simulation created via UI flow.",
    rubric_id: str | None = None,
    department_ids: list[str] | None = None,
    time_limit: int | None = None,
    scenario_ids: list[str] | None = None,
) -> tuple[str, str]:
    """Create a simulation through the UI and return (name, simulation_id)."""
    simulation_name = name or generate_unique_simulation_name("UI Simulation")

    page.goto(f"{base_url}/create/simulations/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-simulation-title")
    name_input.wait_for(state="visible", timeout=20000)
    name_input.fill(simulation_name)

    description_input = page.get_by_test_id("input-simulation-description")
    description_input.wait_for(state="visible", timeout=20000)
    description_input.fill(description)

    # Select rubric (required field)
    rubric_picker = page.locator("[data-testid='picker-rubric']")
    rubric_picker.wait_for(state="visible", timeout=15000)
    rubric_picker.click()
    rubric_option = page.get_by_role("option").first
    if rubric_option.count() > 0:
        rubric_option.wait_for(state="visible", timeout=10000)
        rubric_option.click()
    else:
        # If no options, close picker and continue (will fail validation)
        page.keyboard.press("Escape")

    # Select department if provided
    if department_ids:
        department_picker = page.locator("[data-testid='picker-department']")
        if department_picker.count():
            department_picker.click()
            for dept_id in department_ids:
                dept_option = page.locator(
                    f"[data-testid='department-option'][data-department-id='{dept_id}']"
                )
                if dept_option.count():
                    dept_option.click()
            page.keyboard.press("Escape")

    # Set time limit if provided
    if time_limit is not None:
        time_limit_input = page.get_by_test_id("input-simulation-time-limit")
        time_limit_input.wait_for(state="visible", timeout=10000)
        time_limit_input.fill(str(time_limit))

    # Select scenarios if provided
    if scenario_ids:
        scenario_picker = page.locator("[data-testid='picker-scenario']")
        if scenario_picker.count():
            scenario_picker.click()
            for scenario_id in scenario_ids:
                scenario_option = page.locator(
                    f"[data-testid='scenario-option'][data-scenario-id='{scenario_id}']"
                )
                if scenario_option.count():
                    scenario_option.click()
            page.keyboard.press("Escape")

    submit_button = page.get_by_test_id("btn-submit-simulation")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/create/simulations.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after simulation create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='simulations-grid']", timeout=10000)

    search_input = page.get_by_test_id("simulations-search")
    search_input.fill(simulation_name)
    page.wait_for_timeout(500)

    simulation_card = (
        page.get_by_test_id("simulation-card").filter(has_text=simulation_name).first
    )
    expect(simulation_card).to_be_visible()

    simulation_id = simulation_card.get_attribute("data-simulation-id")
    if not simulation_id:
        raise AssertionError(
            "Created simulation card missing data-simulation-id attribute"
        )

    return simulation_name, simulation_id
