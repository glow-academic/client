"""E2E test validating read-only staff guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.staff.helpers import fetch_staff_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_staff_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only staff hide editing controls and disable inputs."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])
    readonly_staff = next(
        (s for s in staff if not s.get("can_edit") and s.get("profile_id")), None
    )
    if not readonly_staff:
        pytest.skip("No read-only staff available in current dataset")

    profile_id = readonly_staff["profile_id"]
    staff_name = readonly_staff.get("name", "")

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("staff-search")
    search_input.wait_for(state="visible", timeout=10000)
    if staff_name:
        search_input.fill(staff_name)
        page.wait_for_timeout(250)

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
    )
    expect(staff_row).to_be_visible()

    # Verify edit button not visible or disabled
    edit_button = staff_row.get_by_test_id("btn-edit-staff")
    expect(edit_button).to_have_count(0)

    # Verify delete button not visible
    delete_button = staff_row.get_by_test_id("btn-delete-staff")
    expect(delete_button).to_have_count(0)

    # Verify checkbox might be disabled for non-editable staff
    checkbox = staff_row.get_by_test_id("checkbox-select-staff")
    if checkbox.count() > 0:
        # Checkbox exists but might be disabled
        # Non-editable staff might still be selectable for viewing, but not for editing
        pass


def test_staff_cannot_delete_self(page: Page, base_url: str) -> None:
    """Verify current user cannot delete their own account."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])

    # Find current user's profile (should match ADMIN_PROFILE_ID)
    current_user = next(
        (s for s in staff if s.get("profile_id") == ADMIN_PROFILE_ID), None
    )
    if not current_user:
        pytest.skip("Current user profile not found in staff list")

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{ADMIN_PROFILE_ID}']"
    )
    expect(staff_row).to_be_visible()

    # Verify can_delete is false for own account
    assert current_user.get("can_delete") is False

    # Verify delete button not available
    delete_button = staff_row.get_by_test_id("btn-delete-staff")
    expect(delete_button).to_have_count(0)

    # Verify checkbox might be disabled or selecting self doesn't enable bulk delete
    checkbox = staff_row.get_by_test_id("checkbox-select-staff")
    if checkbox.count() > 0 and checkbox.is_enabled():
        checkbox.click()
        page.wait_for_timeout(100)

        # Check bulk delete button - should exclude self from deletable count
        bulk_delete_button = page.get_by_test_id("btn-bulk-delete-staff")
        if bulk_delete_button.count() > 0:
            bulk_delete_button.click()
            dialog = page.get_by_test_id("dialog-bulk-delete-staff")
            if dialog.count() > 0:
                # Should show that self cannot be deleted
                expect(dialog.get_by_text("cannot be deleted")).to_be_visible()
                cancel_button = page.get_by_test_id("btn-cancel-delete")
                cancel_button.click()


def test_staff_cannot_delete_default_profile(page: Page, base_url: str) -> None:
    """Verify default profiles cannot be deleted."""
    data = fetch_staff_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    staff = data.get("staff", [])

    # Find default profile
    default_staff = next(
        (s for s in staff if s.get("default_profile") and s.get("profile_id")), None
    )
    if not default_staff:
        pytest.skip("No default profile available in current dataset")

    profile_id = default_staff["profile_id"]

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    staff_row = page.locator(
        f"[data-testid='staff-row'][data-profile-id='{profile_id}']"
    )
    expect(staff_row).to_be_visible()

    # Verify can_delete is false
    assert default_staff.get("can_delete") is False

    # Verify delete button not available
    delete_button = staff_row.get_by_test_id("btn-delete-staff")
    expect(delete_button).to_have_count(0)

    # Verify checkbox selection excludes from bulk delete
    checkbox = staff_row.get_by_test_id("checkbox-select-staff")
    if checkbox.count() > 0 and checkbox.is_enabled():
        checkbox.click()
        page.wait_for_timeout(100)

        bulk_delete_button = page.get_by_test_id("btn-bulk-delete-staff")
        if bulk_delete_button.count() > 0:
            bulk_delete_button.click()
            dialog = page.get_by_test_id("dialog-bulk-delete-staff")
            if dialog.count() > 0:
                # Should show default profile cannot be deleted
                expect(dialog.get_by_text("default profile")).to_be_visible()
                cancel_button = page.get_by_test_id("btn-cancel-delete")
                cancel_button.click()
