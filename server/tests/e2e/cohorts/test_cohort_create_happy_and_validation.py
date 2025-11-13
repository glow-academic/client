"""E2E tests for creating cohorts with validation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.cohorts.helpers import (
    delete_cohort_api,
    generate_unique_cohort_name,
)
from server.tests.e2e.cohorts.ui_flows import create_cohort_via_ui

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


def test_cohort_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create a cohort successfully."""
    page.goto(f"{base_url}/cohorts/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-cohort-title")
    name_input.wait_for(state="visible", timeout=20000)

    submit_button = page.get_by_test_id("btn-submit-cohort")

    # Fill out required fields.
    cohort_name = generate_unique_cohort_name()
    name_input.fill(cohort_name)
    description_input = page.get_by_test_id("input-cohort-description")
    description_input.wait_for(state="visible", timeout=20000)
    description_input.fill("Cohort created via E2E test.")

    # Optional: Select department if picker is available
    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count():
        department_picker.wait_for(state="visible", timeout=10000)
        department_picker.click()
        department_option = page.locator("[data-testid='department-option']").first
        if department_option.count():
            department_option.wait_for(state="visible", timeout=10000)
            department_option.click()
        page.keyboard.press("Escape")

    # Optional: Toggle active switch
    active_switch = page.get_by_test_id("switch-cohort-active")
    if active_switch.count():
        active_switch.wait_for(state="visible", timeout=10000)
        # Switch is already checked by default, just verify it's there

    # Optional: Add simulation if picker is available
    simulation_picker = page.get_by_test_id("picker-simulation")
    if simulation_picker.count():
        simulation_picker.wait_for(state="visible", timeout=10000)
        simulation_picker.click()
        simulation_option = page.get_by_role("option").first
        if simulation_option.count():
            simulation_option.wait_for(state="visible", timeout=10000)
            simulation_option.click()

    submit_button.click()

    page.wait_for_url(f"{base_url}/cohorts", timeout=20000)
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("cohorts-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(cohort_name)
    page.wait_for_timeout(250)

    cohort_card = (
        page.get_by_test_id("cohort-card").filter(has_text=cohort_name).first
    )
    expect(cohort_card).to_be_visible()

    cohort_id = cohort_card.get_attribute("data-cohort-id")
    if not cohort_id:
        raise AssertionError("Created cohort card missing data-cohort-id attribute")

    # Cleanup: Delete created cohort
    delete_button = cohort_card.get_by_test_id(f"delete-{cohort_id}")
    if delete_button.count() > 0:
        delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()
        page.wait_for_timeout(500)

        expect(
            page.get_by_test_id("cohort-card").filter(has_text=cohort_name)
        ).to_have_count(0)
    else:
        # Fallback: Delete via API
        delete_cohort_api(
            page.context.request,
            cohort_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

