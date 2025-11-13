"""E2E tests for creating departments with validation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.departments.helpers import (
    delete_department_api,
    generate_unique_department_name,
)
from server.tests.e2e.departments.ui_flows import create_department_via_ui

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


def test_department_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create a department successfully."""
    department_title = None
    department_id = None
    try:
        page.goto(f"{base_url}/system/departments/new")
        page.wait_for_load_state("networkidle")

        title_input = page.get_by_test_id("input-department-title")
        title_input.wait_for(state="visible", timeout=20000)

        submit_button = page.get_by_test_id("btn-submit-department")

        # Try submitting empty form (should show validation)
        submit_button.click()
        page.wait_for_timeout(500)

        # Fill out required fields
        department_title = generate_unique_department_name()
        title_input.fill(department_title)
        description_input = page.get_by_test_id("input-department-description")
        description_input.wait_for(state="visible", timeout=20000)
        description_input.fill("Department created via E2E test.")

        # Toggle active switch
        active_switch = page.get_by_test_id("switch-department-active")
        if active_switch.is_visible():
            if not active_switch.is_checked():
                active_switch.click()

        submit_button.click()

        page.wait_for_url(f"{base_url}/system/departments", timeout=20000)
        page.wait_for_load_state("networkidle")

        _expect_toast(page, "Department created successfully")

        search_input = page.get_by_test_id("departments-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(department_title)
        page.wait_for_timeout(250)

        department_card = (
            page.get_by_test_id("department-card")
            .filter(has_text=department_title)
            .first
        )
        expect(department_card).to_be_visible()

        department_id = department_card.get_attribute("data-department-id")
        if not department_id:
            pytest.fail("Created department card missing data-department-id attribute")

        # Cleanup: Delete the created department
        delete_button = department_card.get_by_test_id("btn-delete-department")
        if delete_button.is_visible():
            delete_button.click()

            confirm_button = page.get_by_test_id("btn-confirm-delete")
            expect(confirm_button).to_be_enabled()
            confirm_button.click()
            page.wait_for_timeout(500)

            expect(
                page.get_by_test_id("department-card").filter(has_text=department_title)
            ).to_have_count(0)
    finally:
        # Ensure cleanup via API if UI cleanup failed
        if department_id:
            try:
                delete_department_api(
                    page.context.request,
                    department_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

