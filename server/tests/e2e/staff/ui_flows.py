"""UI flow helpers for staff E2E tests."""

from __future__ import annotations

from typing import Dict, Optional

from playwright.sync_api import Page, expect

from server.tests.e2e.staff.helpers import generate_unique_staff_name


def edit_staff_via_ui(
    page: Page,
    base_url: str,
    profile_id: str,
    *,
    updates: Optional[Dict[str, str]] = None,
) -> None:
    """Edit a staff member through the UI."""
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
    )
    expect(staff_row).to_be_visible()

    edit_button = staff_row.get_by_test_id("btn-edit-staff")
    edit_button.click()

    edit_dialog = page.get_by_test_id("dialog-edit-staff")
    edit_dialog.wait_for(state="visible", timeout=10000)

    if updates:
        if "first_name" in updates:
            first_name_input = page.get_by_test_id("input-staff-first-name")
            first_name_input.fill(updates["first_name"])

        if "last_name" in updates:
            last_name_input = page.get_by_test_id("input-staff-last-name")
            last_name_input.fill(updates["last_name"])

        if "role" in updates:
            role_picker = page.get_by_test_id("input-staff-role")
            role_picker.click()
            page.wait_for_timeout(250)
            role_option = page.get_by_role("option").filter(has_text=updates["role"])
            if role_option.count() > 0:
                role_option.first.click()
            page.wait_for_timeout(250)

        if "requests_per_day" in updates:
            requests_input = page.get_by_test_id("input-staff-requests-per-day")
            requests_input.fill(updates["requests_per_day"])

    submit_button = page.get_by_test_id("btn-submit-staff-edit")
    submit_button.click()

    confirm_dialog = page.get_by_test_id("dialog-confirm-staff-edit")
    confirm_dialog.wait_for(state="visible", timeout=10000)

    confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
    confirm_button.click()

    page.wait_for_timeout(500)
    expect(edit_dialog).not_to_be_visible()


def delete_staff_via_ui(page: Page, base_url: str, profile_id: str) -> None:
    """Delete a staff member through the UI."""
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
    )
    expect(staff_row).to_be_visible()

    delete_button = staff_row.get_by_test_id("btn-delete-staff")
    delete_button.click()

    dialog = page.get_by_test_id("dialog-delete-staff")
    dialog.wait_for(state="visible", timeout=10000)

    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()

    page.wait_for_timeout(500)
    expect(staff_row).to_have_count(0)
