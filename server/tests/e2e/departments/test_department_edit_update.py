"""E2E tests for editing and updating departments."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.departments.helpers import (
    create_department_api,
    delete_department_api,
    generate_unique_department_name,
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


def test_department_edit_update_fields(page: Page, base_url: str) -> None:
    """Test editing department fields and verifying updates persist."""
    department_id = None
    try:
        # Create department via API
        original_title = generate_unique_department_name("Original Department")
        department_id = create_department_api(
            page.context.request,
            title=original_title,
            description="Original description",
            active=True,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to edit page
        page.goto(f"{base_url}/system/departments/d/{department_id}")
        page.wait_for_load_state("networkidle")

        # Verify form is pre-filled
        title_input = page.get_by_test_id("input-department-title")
        title_input.wait_for(state="visible", timeout=15000)
        expect(title_input).to_have_value(original_title)

        description_input = page.get_by_test_id("input-department-description")
        expect(description_input).to_have_value("Original description")

        active_switch = page.get_by_test_id("switch-department-active")
        if active_switch.is_visible():
            expect(active_switch).to_be_checked()

        # Update fields
        updated_title = generate_unique_department_name("Updated Department")
        title_input.fill(updated_title)
        description_input.fill("Updated description")

        # Toggle active switch
        if active_switch.is_visible():
            active_switch.click()
            expect(active_switch).not_to_be_checked()

        # Submit form
        submit_button = page.get_by_test_id("btn-submit-department")
        submit_button.click()

        # Verify redirect and toast
        page.wait_for_url(f"{base_url}/system/departments", timeout=20000)
        _expect_toast(page, "Department updated successfully")

        # Verify updated values appear in list
        search_input = page.get_by_test_id("departments-search")
        search_input.fill(updated_title)
        page.wait_for_timeout(250)

        department_card = (
            page.get_by_test_id("department-card")
            .filter(has_text=updated_title)
            .first
        )
        expect(department_card).to_be_visible()
    finally:
        # Cleanup
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

