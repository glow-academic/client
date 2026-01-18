"""E2E tests for creating simulations with validation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.simulations.helpers import (
    delete_simulation_api,
    generate_unique_simulation_name,
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


def test_simulation_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create a simulation successfully."""
    simulation_id: str | None = None
    try:
        page.goto(f"{base_url}/create/simulations/new")
        page.wait_for_load_state("networkidle")

        # Verify data-page attribute
        page_container = page.locator("[data-page='simulation-new']").first
        expect(page_container).to_be_visible()

        name_input = page.get_by_test_id("input-simulation-title")
        name_input.wait_for(state="visible", timeout=20000)

        submit_button = page.get_by_test_id("btn-submit-simulation")

        # Test validation: submit empty form
        submit_button.click()
        page.wait_for_timeout(500)
        # Should show validation errors or stay on page
        expect(name_input).to_be_visible()

        # Fill out required fields
        simulation_name = generate_unique_simulation_name()
        name_input.fill(simulation_name)

        description_input = page.get_by_test_id("input-simulation-description")
        description_input.wait_for(state="visible", timeout=20000)
        description_input.fill("Simulation created via E2E test.")

        # Select rubric (required)
        rubric_picker = page.locator("[data-testid='picker-rubric']")
        rubric_picker.wait_for(state="visible", timeout=15000)
        rubric_picker.click()
        rubric_option = page.get_by_role("option").first
        if rubric_option.count() > 0:
            rubric_option.wait_for(state="visible", timeout=10000)
            rubric_option.click()
        else:
            pytest.skip("No rubrics available for creating simulation")

        # Fill optional fields
        # Select department
        department_picker = page.locator("[data-testid='picker-department']")
        if department_picker.count() > 0:
            department_picker.click()
            department_option = page.locator("[data-testid='department-option']").first
            if department_option.count():
                department_option.click()
            page.keyboard.press("Escape")

        # Set time limit
        time_limit_input = page.get_by_test_id("input-simulation-time-limit")
        time_limit_input.wait_for(state="visible", timeout=10000)
        time_limit_input.fill("30")

        # Select scenarios
        scenario_picker = page.locator("[data-testid='picker-scenario']")
        if scenario_picker.count() > 0:
            scenario_picker.click()
            scenario_option = page.get_by_role("option").first
            if scenario_option.count():
                scenario_option.click()
            page.keyboard.press("Escape")

        # Toggle active switch
        active_switch = page.get_by_test_id("switch-simulation-active")
        if active_switch.count() > 0:
            active_switch.click()

        submit_button.click()

        page.wait_for_url(f"{base_url}/create/simulations", timeout=20000)
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("simulations-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(simulation_name)
        page.wait_for_timeout(250)

        simulation_card = (
            page.get_by_test_id("simulation-card")
            .filter(has_text=simulation_name)
            .first
        )
        expect(simulation_card).to_be_visible()

        simulation_id_attr = simulation_card.get_attribute("data-simulation-id")
        if simulation_id_attr:
            simulation_id = simulation_id_attr

        delete_button = simulation_card.get_by_test_id("btn-delete-simulation")
        delete_button.click()

        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()
        page.wait_for_timeout(500)

        expect(
            page.get_by_test_id("simulation-card").filter(has_text=simulation_name)
        ).to_have_count(0)
    finally:
        if simulation_id:
            try:
                delete_simulation_api(
                    page.context.request,
                    simulation_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
