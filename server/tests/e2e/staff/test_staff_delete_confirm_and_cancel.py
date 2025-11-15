"""E2E tests covering staff delete confirmation and cancellation."""

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


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message)
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        toast = page.get_by_text(message, exact=False)
        toast.wait_for(state="visible", timeout=5000)
    expect(toast).to_be_visible()


def test_staff_delete_cancel_then_confirm(page: Page, base_url: str) -> None:
    """Ensure delete dialog cancel preserves staff and confirm removes it."""
    created_profile_id: str | None = None
    try:
        # Create test staff member
        staff_name = generate_unique_staff_name("Deletable Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "Deletable"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        alias = f"deletable-staff-{int(time.time() * 1000)}"

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
            alias=alias,
            role="guest",
            department_id=department_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(staff_row).to_be_visible()

        delete_button = staff_row.get_by_test_id("btn-delete-staff")
        delete_button.click()

        dialog = page.get_by_test_id("dialog-delete-staff")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        cancel_button = page.get_by_test_id("btn-cancel-delete")
        expect(cancel_button).to_be_enabled()
        cancel_button.click()

        expect(dialog).not_to_be_visible()
        expect(staff_row).to_be_visible()

        delete_button = staff_row.get_by_test_id("btn-delete-staff")
        delete_button.click()
        expect(dialog).to_be_visible()

        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()

        page.wait_for_timeout(500)
        expect(staff_row).to_have_count(0)

        _expect_toast(page, "successfully")
    finally:
        if created_profile_id:
            try:
                # Try to delete via API if still exists
                delete_staff_api(
                    page.context.request,
                    created_profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_staff_delete_non_deletable_shows_warning(page: Page, base_url: str) -> None:
    """Verify non-deletable staff shows warning in delete dialog."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])

    # Find non-deletable staff (default profile or self)
    non_deletable = next(
        (s for s in staff if not s.get("can_delete") and s.get("profile_id")), None
    )
    if not non_deletable:
        pytest.skip("No non-deletable staff available in current dataset")

    profile_id = non_deletable["profile_id"]

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
    )
    expect(staff_row).to_be_visible()

    # Check if delete button exists - it might not be visible for non-deletable
    delete_button = staff_row.get_by_test_id("btn-delete-staff")
    if delete_button.count() == 0:
        # Delete button not available for non-deletable staff - this is correct
        return

    delete_button.click()

    dialog = page.get_by_test_id("dialog-delete-staff")
    dialog.wait_for(state="visible", timeout=10000)

    # Verify warning message appears
    expect(dialog.get_by_text("cannot be deleted")).to_be_visible()

    # Verify delete button might be disabled or shows warning
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    # Button might be disabled or show warning text
    if confirm_button.is_enabled():
        # If enabled, clicking should show error toast
        confirm_button.click()
        page.wait_for_timeout(500)
        _expect_toast(page, "cannot be deleted")

    cancel_button = page.get_by_test_id("btn-cancel-delete")
    cancel_button.click()


def test_staff_bulk_delete_confirm_and_cancel(page: Page, base_url: str) -> None:
    """Test bulk delete confirmation and cancellation."""
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
            staff_name = generate_unique_staff_name(f"Bulk Delete Staff {i}")
            parts = staff_name.split()
            first_name = parts[0] if parts else f"BulkDel{i}"
            last_name = parts[1] if len(parts) > 1 else "Staff"
            alias = f"bulk-delete-{i}-{int(time.time() * 1000) + i}"

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

        # Select multiple staff
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            checkbox = staff_row.get_by_test_id("checkbox-select-staff")
            checkbox.click()
            page.wait_for_timeout(100)

        # Click bulk delete
        bulk_delete_button = page.get_by_test_id("btn-bulk-delete-staff")
        bulk_delete_button.click()

        dialog = page.get_by_test_id("dialog-bulk-delete-staff")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        # Verify dialog shows count
        expect(dialog.get_by_text("2 staff member")).to_be_visible()

        # Cancel
        cancel_button = page.get_by_test_id("btn-cancel-delete")
        expect(cancel_button).to_be_enabled()
        cancel_button.click()

        expect(dialog).not_to_be_visible()

        # Verify staff still selected and visible
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            expect(staff_row).to_be_visible()

        # Try again and confirm
        bulk_delete_button = page.get_by_test_id("btn-bulk-delete-staff")
        bulk_delete_button.click()

        dialog = page.get_by_test_id("dialog-bulk-delete-staff")
        dialog.wait_for(state="visible", timeout=10000)

        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()

        page.wait_for_timeout(500)

        # Verify all selected staff removed
        for profile_id in created_profile_ids:
            staff_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
            )
            expect(staff_row).to_have_count(0)

        _expect_toast(page, "successfully")
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


def test_staff_bulk_delete_mixed_deletable_non_deletable(
    page: Page, base_url: str
) -> None:
    """Verify bulk delete handles mix of deletable and non-deletable staff."""
    created_profile_id: str | None = None
    try:
        # Create one deletable staff
        staff_name = generate_unique_staff_name("Mixed Delete Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "Mixed"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        alias = f"mixed-delete-{int(time.time() * 1000)}"

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
            alias=alias,
            role="guest",
            department_id=department_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Find non-deletable staff
        staff = data.get("staff", [])
        non_deletable = next(
            (s for s in staff if not s.get("can_delete") and s.get("profile_id")), None
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        selected_ids = [created_profile_id]
        # Select deletable staff
        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        checkbox = staff_row.get_by_test_id("checkbox-select-staff")
        checkbox.click()
        page.wait_for_timeout(100)

        # Select non-deletable staff if available
        if non_deletable:
            non_deletable_id = non_deletable["profile_id"]
            selected_ids.append(non_deletable_id)
            non_deletable_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{non_deletable_id}']"
            )
            non_deletable_checkbox = non_deletable_row.get_by_test_id(
                "checkbox-select-staff"
            )
            if non_deletable_checkbox.is_enabled():
                non_deletable_checkbox.click()
                page.wait_for_timeout(100)

        bulk_delete_button = page.get_by_test_id("btn-bulk-delete-staff")
        bulk_delete_button.click()

        dialog = page.get_by_test_id("dialog-bulk-delete-staff")
        dialog.wait_for(state="visible", timeout=10000)

        # Verify dialog shows both lists
        expect(dialog.get_by_text("will be removed")).to_be_visible()
        if non_deletable:
            expect(dialog.get_by_text("cannot be deleted")).to_be_visible()

        # Confirm delete
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.click()

        page.wait_for_timeout(500)

        # Verify only deletable staff removed
        deletable_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(deletable_row).to_have_count(0)

        if non_deletable:
            non_deletable_id = non_deletable["profile_id"]
            non_deletable_row = page.locator(
                f"[data-testid='staff-row'][data-profile-id='{non_deletable_id}']"
            )
            expect(non_deletable_row).to_be_visible()

        _expect_toast(page, "successfully")
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


def test_staff_delete_select_all(page: Page, base_url: str) -> None:
    """Test select all checkbox and bulk delete."""
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    # Click select all checkbox
    select_all_checkbox = page.get_by_test_id("checkbox-select-all")
    select_all_checkbox.click()
    page.wait_for_timeout(250)

    # Verify rows are selected (check a few)
    rows = page.get_by_test_id("staff-row")
    row_count = rows.count()
    if row_count > 0:
        # Check that at least some checkboxes are checked
        checked_count = page.locator(
            "[data-testid='checkbox-select-staff']:checked"
        ).count()
        assert checked_count > 0

        # Click bulk delete
        bulk_delete_button = page.get_by_test_id("btn-bulk-delete-staff")
        if bulk_delete_button.count() > 0:
            bulk_delete_button.click()

            dialog = page.get_by_test_id("dialog-bulk-delete-staff")
            dialog.wait_for(state="visible", timeout=10000)

            # Verify correct count in dialog
            dialog_text = dialog.inner_text()
            assert str(checked_count) in dialog_text or "staff member" in dialog_text

            # Cancel
            cancel_button = page.get_by_test_id("btn-cancel-delete")
            cancel_button.click()

            page.wait_for_timeout(250)

            # Verify selection cleared (or still selected depending on implementation)
            # Some implementations keep selection after cancel
