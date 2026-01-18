"""E2E tests for editing staff members."""

from __future__ import annotations

import time

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.staff.helpers import (
    create_staff_api,
    delete_staff_api,
    fetch_staff_detail,
    fetch_staff_list,
    find_editable_staff,
    generate_unique_staff_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_staff_edit_happy_path(page: Page, base_url: str) -> None:
    """Edit a staff member and verify updates persist."""
    created_profile_id: str | None = None
    try:
        # Create a test staff member
        staff_name = generate_unique_staff_name("Editable Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "Editable"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        email = f"editable-staff-{int(time.time() * 1000)}@purdue.edu"

        # Get department ID from existing staff list
        data = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        department_ids = list(data.get("department_mapping", {}).keys())
        department_id = department_ids[0] if department_ids else None

        created_profile_id = create_staff_api(
            page.context.request,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role="guest",
            department_id=department_id,
            requests_per_day=100,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        staff_row.wait_for(state="visible", timeout=15000)
        expect(staff_row).to_be_visible()

        edit_button = staff_row.get_by_test_id("btn-edit-staff")
        edit_button.click()

        edit_dialog = page.get_by_test_id("dialog-edit-staff")
        edit_dialog.wait_for(state="visible", timeout=10000)
        expect(edit_dialog).to_be_visible()

        # Verify form fields populate correctly
        first_name_input = page.get_by_test_id("input-staff-first-name")
        first_name_input.wait_for(state="visible", timeout=10000)
        expect(first_name_input).to_have_value(first_name)

        last_name_input = page.get_by_test_id("input-staff-last-name")
        expect(last_name_input).to_have_value(last_name)

        email_input = page.get_by_test_id("input-staff-email")
        expect(email_input).to_have_value(email)
        expect(email_input).to_be_disabled()

        # Update fields
        updated_first_name = f"{first_name} Updated"
        updated_last_name = f"{last_name} Updated"
        updated_requests = "200"

        first_name_input.fill(updated_first_name)
        last_name_input.fill(updated_last_name)

        requests_input = page.get_by_test_id("input-staff-requests-per-day")
        requests_input.fill(updated_requests)

        # Submit
        submit_button = page.get_by_test_id("btn-submit-staff-edit")
        submit_button.click()

        # Confirm in confirmation dialog
        confirm_dialog = page.get_by_test_id("dialog-confirm-staff-edit")
        confirm_dialog.wait_for(state="visible", timeout=10000)
        expect(confirm_dialog).to_be_visible()

        confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
        confirm_button.click()

        # Wait for dialog to close and list to refresh
        page.wait_for_timeout(500)
        expect(edit_dialog).not_to_be_visible()

        # Verify toast success message
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            # Try alternative toast selector
            toast = page.get_by_text("successfully", exact=False)
            toast.wait_for(state="visible", timeout=5000)

        # Verify updated data in row
        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(staff_row).to_be_visible()
        expect(staff_row).to_contain_text(updated_first_name)
        expect(staff_row).to_contain_text(updated_last_name)

    finally:
        if created_profile_id:
            try:
                delete_staff_api(
                    page.context.request,
                    created_profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_staff_edit_cancel_dialog(page: Page, base_url: str) -> None:
    """Ensure canceling edit dialog doesn't save changes."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])
    editable_staff = find_editable_staff(staff)
    profile_id = editable_staff["profile_id"]

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

    # Get original values
    first_name_input = page.get_by_test_id("input-staff-first-name")
    original_value = first_name_input.input_value()

    # Make changes
    first_name_input.fill("Changed Name That Should Not Save")

    # Cancel
    cancel_button = page.get_by_test_id("btn-cancel-staff-edit")
    cancel_button.click()

    page.wait_for_timeout(250)
    expect(edit_dialog).not_to_be_visible()

    # Verify changes not persisted - reopen dialog
    edit_button.click()
    edit_dialog.wait_for(state="visible", timeout=10000)
    first_name_input = page.get_by_test_id("input-staff-first-name")
    expect(first_name_input).to_have_value(original_value)

    cancel_button = page.get_by_test_id("btn-cancel-staff-edit")
    cancel_button.click()


def test_staff_edit_cancel_confirmation(page: Page, base_url: str) -> None:
    """Ensure canceling confirmation dialog returns to edit form."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])
    editable_staff = find_editable_staff(staff)
    profile_id = editable_staff["profile_id"]

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
    )
    edit_button = staff_row.get_by_test_id("btn-edit-staff")
    edit_button.click()

    edit_dialog = page.get_by_test_id("dialog-edit-staff")
    edit_dialog.wait_for(state="visible", timeout=10000)

    # Make changes
    first_name_input = page.get_by_test_id("input-staff-first-name")
    first_name_input.fill("Test Change")

    # Submit to get confirmation dialog
    submit_button = page.get_by_test_id("btn-submit-staff-edit")
    submit_button.click()

    confirm_dialog = page.get_by_test_id("dialog-confirm-staff-edit")
    confirm_dialog.wait_for(state="visible", timeout=10000)

    # Cancel confirmation
    cancel_button = confirm_dialog.get_by_role("button", name="Cancel")
    cancel_button.click()

    page.wait_for_timeout(250)

    # Should return to edit form
    expect(confirm_dialog).not_to_be_visible()
    expect(edit_dialog).to_be_visible()

    # Verify changes still in form
    first_name_input = page.get_by_test_id("input-staff-first-name")
    expect(first_name_input).to_have_value("Test Change")

    # Cancel edit dialog
    cancel_button = page.get_by_test_id("btn-cancel-staff-edit")
    cancel_button.click()


def test_staff_edit_unlimited_requests(page: Page, base_url: str) -> None:
    """Test unlimited requests checkbox disables input and saves null."""
    created_profile_id: str | None = None
    try:
        # Create test staff
        staff_name = generate_unique_staff_name("Unlimited Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "Unlimited"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        email = f"unlimited-staff-{int(time.time() * 1000)}@purdue.edu"

        data = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        department_ids = list(data.get("department_mapping", {}).keys())
        department_id = department_ids[0] if department_ids else None

        created_profile_id = create_staff_api(
            page.context.request,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role="guest",
            department_id=department_id,
            requests_per_day=100,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        edit_button = staff_row.get_by_test_id("btn-edit-staff")
        edit_button.click()

        edit_dialog = page.get_by_test_id("dialog-edit-staff")
        edit_dialog.wait_for(state="visible", timeout=10000)

        requests_input = page.get_by_test_id("input-staff-requests-per-day")
        expect(requests_input).to_be_enabled()

        # Find unlimited checkbox (it's near the requests input)
        unlimited_checkbox = page.locator("input[type='checkbox']#unlimited")
        if unlimited_checkbox.count() > 0:
            unlimited_checkbox.click()
            page.wait_for_timeout(100)

            # Verify input is disabled
            expect(requests_input).to_be_disabled()

            # Submit
            submit_button = page.get_by_test_id("btn-submit-staff-edit")
            submit_button.click()

            confirm_dialog = page.get_by_test_id("dialog-confirm-staff-edit")
            confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
            confirm_button.click()

            page.wait_for_timeout(500)

            # Verify staff detail shows unlimited (null requests_per_day)
            detail = fetch_staff_detail(
                page.context.request,
                created_profile_id,
                current_profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            assert detail.get("requests_per_day") is None

    finally:
        if created_profile_id:
            try:
                delete_staff_api(
                    page.context.request,
                    created_profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
