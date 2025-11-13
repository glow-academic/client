"""E2E tests for editing and updating cohorts."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.cohorts.helpers import (
    create_cohort_api,
    delete_cohort_api,
    generate_unique_cohort_name,
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


def test_cohort_edit_updates_fields(page: Page, base_url: str) -> None:
    """Verify editing a cohort updates fields correctly."""
    cohort_id = None
    try:
        # Create cohort via API and store the actual generated name
        original_name = generate_unique_cohort_name("Edit Test Cohort")
        cohort_id = create_cohort_api(
            page.context.request,
            name=original_name,
            description="Original description",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to edit page
        page.goto(f"{base_url}/cohorts/e/{cohort_id}")
        page.wait_for_load_state("networkidle")
        
        # Wait for the page container to be visible
        page.wait_for_selector("[data-page='cohort-edit']", timeout=15000)

        # Verify form pre-populates
        name_input = page.get_by_test_id("input-cohort-title")
        name_input.wait_for(state="visible", timeout=20000)
        expect(name_input).to_have_value(original_name)

        description_input = page.get_by_test_id("input-cohort-description")
        description_input.wait_for(state="visible", timeout=20000)
        expect(description_input).to_have_value("Original description")

        # Update fields
        new_name = generate_unique_cohort_name("Updated Cohort")
        name_input.fill(new_name)
        description_input.fill("Updated description")

        # Toggle active switch if available
        active_switch = page.get_by_test_id("switch-cohort-active")
        if active_switch.count():
            current_state = active_switch.is_checked()
            active_switch.set_checked(not current_state)

        # Submit update
        submit_button = page.get_by_test_id("btn-submit-cohort")
        submit_button.click()

        # Wait for redirect or update confirmation
        page.wait_for_timeout(1000)

        # Verify changes persisted by navigating back to list
        page.goto(f"{base_url}/cohorts")
        page.wait_for_load_state("networkidle")
        
        # Wait for the grid to be visible
        page.wait_for_selector("[data-testid='cohorts-grid']", timeout=10000)

        search_input = page.get_by_test_id("cohorts-search")
        search_input.fill(new_name)
        page.wait_for_timeout(500)

        cohort_card = (
            page.get_by_test_id("cohort-card").filter(has_text=new_name).first
        )
        expect(cohort_card).to_be_visible()
    finally:
        if cohort_id:
            try:
                delete_cohort_api(
                    page.context.request,
                    cohort_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_cohort_edit_simulation_management(page: Page, base_url: str) -> None:
    """Verify adding and removing simulations in edit mode."""
    cohort_id = None
    try:
        # Create cohort via API
        cohort_id = create_cohort_api(
            page.context.request,
            name=generate_unique_cohort_name("Simulation Test Cohort"),
            description="Cohort for simulation management test",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to edit page
        page.goto(f"{base_url}/cohorts/e/{cohort_id}")
        page.wait_for_load_state("networkidle")
        
        # Wait for the page container to be visible
        page.wait_for_selector("[data-page='cohort-edit']", timeout=15000)

        # Check if simulation picker is available
        simulation_picker = page.get_by_test_id("picker-simulation")
        if simulation_picker.count() == 0:
            pytest.skip("No simulations available to add")

        simulation_picker.wait_for(state="visible", timeout=10000)
        simulation_picker.click()

        # Select first available simulation
        simulation_option = page.get_by_role("option").first
        if simulation_option.count() == 0:
            pytest.skip("No simulation options available")
        simulation_option.wait_for(state="visible", timeout=10000)
        simulation_name = simulation_option.inner_text()
        simulation_option.click()

        # Verify simulation card appears
        page.wait_for_timeout(500)
        simulation_card = page.get_by_test_id("simulation-card").filter(
            has_text=simulation_name
        )
        expect(simulation_card).to_be_visible()

        # Get simulation ID from card
        simulation_id = simulation_card.first.get_attribute("data-simulation-id")
        if not simulation_id:
            pytest.skip("Simulation card missing data-simulation-id")

        # Remove simulation
        remove_button = simulation_card.get_by_test_id("btn-remove-simulation")
        if remove_button.count() > 0:
            remove_button.click()
            page.wait_for_timeout(500)
            expect(simulation_card).to_have_count(0)

        # Submit to save changes
        submit_button = page.get_by_test_id("btn-submit-cohort")
        submit_button.click()
        page.wait_for_timeout(1000)
    finally:
        if cohort_id:
            try:
                delete_cohort_api(
                    page.context.request,
                    cohort_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

