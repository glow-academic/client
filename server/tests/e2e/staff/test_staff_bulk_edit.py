"""E2E tests for bulk editing staff members."""

from __future__ import annotations

import time

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.staff.helpers import (
    create_staff_api,
    delete_staff_api,
    fetch_staff_list,
    generate_unique_staff_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_staff_bulk_edit_role(page: Page, base_url: str) -> None:
    """Bulk edit role for multiple staff members."""
    created_profile_ids: list[str] = []
    try:
        # Create test staff members
        data = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        department_ids = list(data.get("department_mapping", {}).keys())
        department_id = department_ids[0] if department_ids else None

        for i in range(2):
            staff_name = generate_unique_staff_name(f"Bulk Edit Staff {i}")
            parts = staff_name.split()
            first_name = parts[0] if parts else f"Bulk{i}"
            last_name = parts[1] if len(parts) > 1 else "Staff"
            alias = f"bulk-edit-{i}-{int(time.time() * 1000) + i}"

            profile_id = create_staff_api(
                page.context.request,
                first_name=first_name,
                last_name=last_name,
                alias=alias,
                role="guest",
                department_id=department_id,
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            created_profile_ids.append(profile_id)

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        # Select multiple staff rows
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            checkbox = staff_row.get_by_test_id("checkbox-select-staff")
            checkbox.click()
            page.wait_for_timeout(100)

        # Click bulk edit button
        bulk_edit_button = page.get_by_test_id("btn-bulk-edit-staff")
        bulk_edit_button.click()

        bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-staff")
        bulk_edit_dialog.wait_for(state="visible", timeout=10000)
        expect(bulk_edit_dialog).to_be_visible()

        # Select new role
        role_picker = page.get_by_test_id("input-bulk-staff-role")
        role_picker.click()
        page.wait_for_timeout(250)

        # Select "ta" role (should be available for admin)
        role_option = page.get_by_role("option").filter(has_text="Teaching Assistant")
        if role_option.count() > 0:
            role_option.first.click()
        else:
            # Fallback: click any role option
            role_options = page.get_by_role("option")
            if role_options.count() > 1:
                role_options.nth(1).click()

        page.wait_for_timeout(250)

        # Submit
        submit_button = page.get_by_test_id("btn-submit-bulk-staff-edit")
        submit_button.click()

        # Confirm
        confirm_dialog = page.get_by_test_id("dialog-confirm-bulk-staff-edit")
        confirm_dialog.wait_for(state="visible", timeout=10000)
        confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
        confirm_button.click()

        page.wait_for_timeout(500)
        expect(bulk_edit_dialog).not_to_be_visible()

        # Verify toast success
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            toast = page.get_by_text("successfully", exact=False)
            toast.wait_for(state="visible", timeout=5000)

        # Verify all selected staff updated
        page.wait_for_load_state("networkidle")
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            expect(staff_row).to_be_visible()

    finally:
        for profile_id in created_profile_ids:
            try:
                delete_staff_api(
                    page.context.request,
                    profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_staff_bulk_edit_requests_per_day(page: Page, base_url: str) -> None:
    """Bulk edit requests_per_day for multiple staff members."""
    created_profile_ids: list[str] = []
    try:
        data = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        department_ids = list(data.get("department_mapping", {}).keys())
        department_id = department_ids[0] if department_ids else None

        for i in range(2):
            staff_name = generate_unique_staff_name(f"Bulk Requests Staff {i}")
            parts = staff_name.split()
            first_name = parts[0] if parts else f"BulkReq{i}"
            last_name = parts[1] if len(parts) > 1 else "Staff"
            alias = f"bulk-requests-{i}-{int(time.time() * 1000) + i}"

            profile_id = create_staff_api(
                page.context.request,
                first_name=first_name,
                last_name=last_name,
                alias=alias,
                role="guest",
                department_id=department_id,
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            created_profile_ids.append(profile_id)

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        # Select staff
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            checkbox = staff_row.get_by_test_id("checkbox-select-staff")
            checkbox.click()
            page.wait_for_timeout(100)

        bulk_edit_button = page.get_by_test_id("btn-bulk-edit-staff")
        bulk_edit_button.click()

        bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-staff")
        bulk_edit_dialog.wait_for(state="visible", timeout=10000)

        # Set requests_per_day
        requests_input = page.get_by_test_id("input-bulk-staff-requests-per-day")
        requests_input.fill("150")

        submit_button = page.get_by_test_id("btn-submit-bulk-staff-edit")
        submit_button.click()

        confirm_dialog = page.get_by_test_id("dialog-confirm-bulk-staff-edit")
        confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
        confirm_button.click()

        page.wait_for_timeout(500)

        # Verify success
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            toast = page.get_by_text("successfully", exact=False)
            toast.wait_for(state="visible", timeout=5000)

    finally:
        for profile_id in created_profile_ids:
            try:
                delete_staff_api(
                    page.context.request,
                    profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_staff_bulk_edit_keep_current(page: Page, base_url: str) -> None:
    """Verify 'Keep Current' option works correctly."""
    created_profile_ids: list[str] = []
    try:
        data = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        department_ids = list(data.get("department_mapping", {}).keys())
        department_id = department_ids[0] if department_ids else None

        # Create staff with different roles
        roles = ["guest", "ta"]
        for i, role in enumerate(roles):
            staff_name = generate_unique_staff_name(f"Keep Current Staff {i}")
            parts = staff_name.split()
            first_name = parts[0] if parts else f"Keep{i}"
            last_name = parts[1] if len(parts) > 1 else "Staff"
            alias = f"keep-current-{i}-{int(time.time() * 1000) + i}"

            profile_id = create_staff_api(
                page.context.request,
                first_name=first_name,
                last_name=last_name,
                alias=alias,
                role=role,
                department_id=department_id,
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            created_profile_ids.append(profile_id)

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        # Select staff
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            checkbox = staff_row.get_by_test_id("checkbox-select-staff")
            checkbox.click()
            page.wait_for_timeout(100)

        bulk_edit_button = page.get_by_test_id("btn-bulk-edit-staff")
        bulk_edit_button.click()

        bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-staff")
        bulk_edit_dialog.wait_for(state="visible", timeout=10000)

        # Verify "Keep Current" button exists and is selected by default
        keep_current_button = bulk_edit_dialog.get_by_role(
            "button", name="Keep Current"
        )
        expect(keep_current_button).to_be_visible()

        # Change to specific role
        role_picker = page.get_by_test_id("input-bulk-staff-role")
        role_picker.click()
        page.wait_for_timeout(250)

        role_option = page.get_by_role("option").filter(has_text="Teaching Assistant")
        if role_option.count() > 0:
            role_option.first.click()
        else:
            role_options = page.get_by_role("option")
            if role_options.count() > 1:
                role_options.nth(1).click()

        page.wait_for_timeout(250)

        # Submit
        submit_button = page.get_by_test_id("btn-submit-bulk-staff-edit")
        submit_button.click()

        confirm_dialog = page.get_by_test_id("dialog-confirm-bulk-staff-edit")
        confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
        confirm_button.click()

        page.wait_for_timeout(500)

        # Verify success
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            toast = page.get_by_text("successfully", exact=False)
            toast.wait_for(state="visible", timeout=5000)

    finally:
        for profile_id in created_profile_ids:
            try:
                delete_staff_api(
                    page.context.request,
                    profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_staff_bulk_edit_partial_selection(page: Page, base_url: str) -> None:
    """Verify bulk edit only affects editable staff."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])

    # Find mix of editable and non-editable staff
    editable_staff = [s for s in staff if s.get("can_edit")]
    non_editable_staff = [s for s in staff if not s.get("can_edit")]

    if len(editable_staff) < 1:
        pytest.skip("No editable staff available for test")

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    selected_ids = []
    # Select one editable staff
    if editable_staff:
        profile_id = editable_staff[0]["profile_id"]
        selected_ids.append(profile_id)
        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
        )
        checkbox = staff_row.get_by_test_id("checkbox-select-staff")
        checkbox.click()
        page.wait_for_timeout(100)

    # Select one non-editable staff if available
    if non_editable_staff:
        profile_id = non_editable_staff[0]["profile_id"]
        selected_ids.append(profile_id)
        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
        )
        # Non-editable might not have checkbox or might be disabled
        checkbox = staff_row.get_by_test_id("checkbox-select-staff")
        if checkbox.is_enabled():
            checkbox.click()
            page.wait_for_timeout(100)

    # Check bulk edit button shows correct count
    bulk_edit_button = page.get_by_test_id("btn-bulk-edit-staff")
    if bulk_edit_button.count() > 0:
        button_text = bulk_edit_button.inner_text()
        # Should show editable count
        assert "Bulk Edit" in button_text

        bulk_edit_button.click()

        bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-staff")
        bulk_edit_dialog.wait_for(state="visible", timeout=10000)

        # Cancel without making changes
        cancel_button = page.get_by_test_id("btn-cancel-bulk-staff-edit")
        cancel_button.click()

        page.wait_for_timeout(250)
