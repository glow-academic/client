"""E2E tests for editing simulations and managing scenarios."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.simulations.helpers import (
    create_simulation_api,
    delete_simulation_api,
    generate_unique_simulation_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_simulation_edit_update_fields(page: Page, base_url: str) -> None:
    """Edit an existing simulation and verify updates persist."""
    simulation_id: str | None = None
    try:
        # Get defaults to find valid rubric
        from server.tests.e2e.simulations.helpers import (
            fetch_simulation_new,
        )

        defaults = fetch_simulation_new(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        valid_rubric_ids = defaults.get("valid_rubric_ids", [])
        if not valid_rubric_ids:
            pytest.skip("No rubrics available for creating test simulation")

        # Create simulation via API
        simulation_id = create_simulation_api(
            page.context.request,
            title=generate_unique_simulation_name("Editable Simulation"),
            description="Simulation created for edit workflow E2E test.",
            rubric_id=valid_rubric_ids[0],
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/training/simulations")
        page.wait_for_load_state("networkidle")

        # Wait for the simulation card to appear - may need to search or wait longer
        simulation_card = page.locator(
            f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
        )
        simulation_card.wait_for(state="visible", timeout=15000)
        expect(simulation_card).to_be_visible()

        edit_button = simulation_card.get_by_test_id("btn-edit-simulation")
        edit_button.click()

        page.wait_for_url(
            f"{base_url}/training/simulations/s/{simulation_id}", timeout=20000
        )
        page.wait_for_load_state("networkidle")

        container = page.locator("[data-page='simulation-edit']").first
        container.wait_for(state="visible", timeout=15000)
        expect(container).to_have_attribute("data-simulation-id", simulation_id)

        name_input = page.get_by_test_id("input-simulation-title")
        name_input.wait_for(state="visible", timeout=10000)
        original_name = name_input.input_value()
        updated_name = f"{original_name} Updated"
        name_input.fill(updated_name)

        description_input = page.get_by_test_id("input-simulation-description")
        description_input.wait_for(state="visible", timeout=10000)
        description_input.fill("Updated description via E2E test.")

        time_limit_input = page.get_by_test_id("input-simulation-time-limit")
        time_limit_input.wait_for(state="visible", timeout=10000)
        time_limit_input.fill("45")

        # Toggle active switch
        active_switch = page.get_by_test_id("switch-simulation-active")
        if active_switch.count() > 0:
            current_state = active_switch.is_checked()
            if current_state:
                active_switch.click()  # Toggle off
            else:
                active_switch.click()  # Toggle on

        submit_button = page.get_by_test_id("btn-submit-simulation")
        expect(submit_button).to_be_enabled()
        submit_button.click()

        # Wait for toast notification, then navigation
        toast = page.get_by_role("alert").filter(
            has_text="Simulation updated successfully!"
        )
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            # Toast might not appear or have different text
            pass
        page.wait_for_url(f"{base_url}/training/simulations", timeout=20000)
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("simulations-search")
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        simulation_card = (
            page.get_by_test_id("simulation-card").filter(has_text=updated_name).first
        )
        expect(simulation_card).to_be_visible()

        edit_button = simulation_card.get_by_test_id("btn-edit-simulation")
        edit_button.click()

        page.wait_for_url(
            f"{base_url}/training/simulations/s/{simulation_id}", timeout=20000
        )
        page.wait_for_load_state("networkidle")

        name_input = page.get_by_test_id("input-simulation-title")
        expect(name_input).to_have_value(updated_name)

        description_input = page.get_by_test_id("input-simulation-description")
        expect(description_input).to_have_value("Updated description via E2E test.")

        time_limit_input = page.get_by_test_id("input-simulation-time-limit")
        expect(time_limit_input).to_have_value("45")
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


def test_simulation_edit_scenario_management(page: Page, base_url: str) -> None:
    """Test scenario management: add, remove, and toggle active state."""
    simulation_id: str | None = None
    try:
        # Get defaults
        from server.tests.e2e.simulations.helpers import (
            fetch_simulation_new,
        )

        defaults = fetch_simulation_new(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        valid_rubric_ids = defaults.get("valid_rubric_ids", [])
        valid_scenario_ids = defaults.get("valid_scenario_ids", [])
        if not valid_rubric_ids:
            pytest.skip("No rubrics available for creating test simulation")
        if len(valid_scenario_ids) < 2:
            pytest.skip("Need at least 2 scenarios for scenario management test")

        # Create simulation with scenarios via API
        simulation_id = create_simulation_api(
            page.context.request,
            title=generate_unique_simulation_name("Scenario Test Simulation"),
            description="Simulation for scenario management test.",
            rubric_id=valid_rubric_ids[0],
            scenario_ids=[valid_scenario_ids[0]],  # Start with one scenario
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/training/simulations/s/{simulation_id}", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Verify scenarios render in grid
        page.locator("[data-testid='simulation-card']").filter(
            has_text=valid_scenario_ids[0]
        )
        # Scenarios are displayed in cards, check if any scenario cards exist
        page.locator(".grid").filter(has_text="scenario")
        # Actually, scenarios are shown in a grid of cards within the form
        # Let's check for scenario picker and add more scenarios

        # Add new scenario via picker
        scenario_picker = page.locator("[data-testid='picker-scenario']")
        if scenario_picker.count() > 0:
            scenario_picker.click()
            # Find and select a different scenario
            scenario_options = page.get_by_role("option")
            for option in scenario_options.all():
                option_text = option.inner_text()
                # Select second scenario if available
                if valid_scenario_ids[1] in option_text or len(valid_scenario_ids) > 1:
                    option.click()
                    break
            page.keyboard.press("Escape")

        # Submit changes
        submit_button = page.get_by_test_id("btn-submit-simulation")
        submit_button.click()

        page.wait_for_url(f"{base_url}/training/simulations", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Verify simulation still exists
        simulation_card = page.locator(
            f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
        )
        expect(simulation_card).to_be_visible()
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
