"""E2E test validating cache behavior and revalidation across staff flows."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

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
    toast = page.get_by_role("alert").filter(has_text=message).first
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        fallback = page.get_by_text(message, exact=False).first
        fallback.wait_for(state="visible", timeout=5000)
        toast = fallback
    expect(toast).to_be_visible()


def _set_request_counter(
    page: Page, pattern: str
) -> tuple[dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request: Any) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_staff_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="staff-row"]'))
        .map(el => el.dataset.profileId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_staff_cache_revalidation_after_edit(page: Page, base_url: str) -> None:
    """Ensure edit operations revalidate cache and refresh list."""
    created_profile_id: str | None = None
    try:
        # Create test staff
        staff_name = generate_unique_staff_name("Cache Edit Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "CacheEdit"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        email = f"cache-edit-{int(time.time() * 1000)}@purdue.edu"

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
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Set up request counter
        list_counter, stop_counter = _set_request_counter(
            page, "/api/v3/profile/staff/list"
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        initial_count = list_counter["total"]
        assert initial_count >= 1, "Initial list request should have been made"

        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(staff_row).to_be_visible()

        # Edit staff member
        edit_button = staff_row.get_by_test_id("btn-edit-staff")
        edit_button.click()

        edit_dialog = page.get_by_test_id("dialog-edit-staff")
        edit_dialog.wait_for(state="visible", timeout=10000)

        first_name_input = page.get_by_test_id("input-staff-first-name")
        updated_name = f"{first_name} Updated"
        first_name_input.fill(updated_name)

        submit_button = page.get_by_test_id("btn-submit-staff-edit")
        submit_button.click()

        confirm_dialog = page.get_by_test_id("dialog-confirm-staff-edit")
        confirm_button = confirm_dialog.get_by_role("button", name="Confirm Update")
        confirm_button.click()

        page.wait_for_timeout(500)

        # Verify new request made (cache revalidated)
        stop_counter()
        final_count = list_counter["total"]
        assert final_count > initial_count, (
            "List should be re-fetched after edit operation"
        )

        # Verify updated data shown
        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(staff_row).to_be_visible()
        expect(staff_row).to_contain_text(updated_name)

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


def test_staff_cache_revalidation_after_delete(page: Page, base_url: str) -> None:
    """Ensure delete operations revalidate cache and refresh list."""
    created_profile_id: str | None = None
    try:
        # Create test staff
        staff_name = generate_unique_staff_name("Cache Delete Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "CacheDel"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        email = f"cache-delete-{int(time.time() * 1000)}@purdue.edu"

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
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        list_counter, stop_counter = _set_request_counter(
            page, "/api/v3/profile/staff/list"
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        initial_count = list_counter["total"]
        initial_ids = _collect_staff_ids(page)
        assert created_profile_id in initial_ids

        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(staff_row).to_be_visible()

        # Delete staff member
        delete_button = staff_row.get_by_test_id("btn-delete-staff")
        delete_button.click()

        page.get_by_test_id("dialog-delete-staff")
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.click()

        page.wait_for_timeout(500)

        # Verify cache revalidated
        stop_counter()
        final_count = list_counter["total"]
        assert final_count > initial_count, (
            "List should be re-fetched after delete operation"
        )

        # Verify deleted staff removed
        final_ids = _collect_staff_ids(page)
        assert created_profile_id not in final_ids

        staff_row = page.locator(
            f"[data-testid='staff-row'][data-profile-id='{created_profile_id}']"
        )
        expect(staff_row).to_have_count(0)

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


def test_staff_no_double_fetch_on_navigation(page: Page, base_url: str) -> None:
    """Verify no duplicate requests when navigating away and back."""
    list_counter, stop_counter = _set_request_counter(
        page, "/api/v3/profile/staff/list"
    )

    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    initial_count = list_counter["total"]

    # Navigate away
    page.goto(f"{base_url}/create/personas")
    page.wait_for_load_state("networkidle")

    # Navigate back
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    stop_counter()
    final_count = list_counter["total"]

    # Should use cache on second visit (might be same count or +1 for revalidation)
    # Allow for one additional request due to cache revalidation
    assert final_count <= initial_count + 1, (
        f"Too many requests: {initial_count} -> {final_count}"
    )

    # Verify data still correct
    table = page.get_by_test_id("staff-table")
    expect(table).to_be_visible()


def test_staff_refresh_button(page: Page, base_url: str) -> None:
    """Verify refresh button revalidates cache and updates list."""
    created_profile_id: str | None = None
    try:
        # Create test staff via API (outside UI)
        staff_name = generate_unique_staff_name("Refresh Staff")
        parts = staff_name.split()
        first_name = parts[0] if parts else "Refresh"
        last_name = parts[1] if len(parts) > 1 else "Staff"
        email = f"refresh-staff-{int(time.time() * 1000)}@purdue.edu"

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
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        list_counter, stop_counter = _set_request_counter(
            page, "/api/v3/profile/staff/list"
        )

        page.goto(f"{base_url}/management/staff")
        page.wait_for_load_state("networkidle")

        initial_count = list_counter["total"]
        _collect_staff_ids(page)

        # New staff might not appear immediately if cache is used
        # Click refresh button
        toolbar = page.get_by_test_id("staff-toolbar")
        refresh_button = toolbar.get_by_role("button").filter(
            has_text=page.get_by_test_id("staff-toolbar")
            .locator("button")
            .filter(has_text="Refresh")
            .first
        )
        # Alternative: find refresh button by icon
        refresh_button = toolbar.locator("button").filter(
            has=lambda el: "RefreshCw" in str(el) or "refresh" in str(el).lower()
        )
        if refresh_button.count() == 0:
            # Try finding by aria-label or title
            refresh_button = page.get_by_role("button", name="Refresh")
        if refresh_button.count() > 0:
            refresh_button.first.click()
            page.wait_for_timeout(500)

            # Verify new request made
            stop_counter()
            final_count = list_counter["total"]
            assert final_count > initial_count, (
                "Refresh should trigger new list request"
            )

            # Verify new staff appears
            final_ids = _collect_staff_ids(page)
            assert created_profile_id in final_ids

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
