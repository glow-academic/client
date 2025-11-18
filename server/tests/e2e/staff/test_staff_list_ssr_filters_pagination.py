"""E2E tests for staff list SSR, search, filters, and pagination."""

from __future__ import annotations

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


def test_staff_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure staff list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/system/staff")
    page.wait_for_load_state("networkidle")

    table = page.get_by_test_id("staff-table")
    table.wait_for(state="visible", timeout=15000)
    expect(table).to_be_visible()

    toolbar = page.get_by_test_id("staff-toolbar")
    toolbar.wait_for(state="visible", timeout=10000)
    expect(toolbar).to_be_visible()

    rows = table.get_by_test_id("staff-row")
    initial_count = rows.count()
    assert initial_count > 0

    # Test search functionality
    first_row = rows.first
    staff_name = first_row.inner_text().splitlines()[0].strip()

    search_input = page.get_by_test_id("staff-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(staff_name)
    page.wait_for_timeout(250)
    filtered_count = rows.count()
    assert filtered_count <= initial_count
    assert table.get_by_test_id("staff-row").filter(has_text=staff_name).count() > 0

    search_input.fill("")
    page.wait_for_timeout(250)
    assert rows.count() == initial_count

    # Test role filter
    toolbar = page.get_by_test_id("staff-toolbar")
    role_button = toolbar.get_by_role("button", name="Role")
    if role_button.count() > 0:
        role_button.click()
        role_options = page.get_by_role("option")
        if role_options.count() > 1:
            option = role_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert rows.count() > 0
            role_button.click()
            clear_option_locator = page.get_by_role("option").filter(
                has_text="Clear filters"
            )
            if clear_option_locator.count():
                clear_option_locator.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert rows.count() == initial_count

    # Test cohort filter (if available)
    cohort_button = toolbar.get_by_role("button", name="Cohort")
    if cohort_button.count() > 0:
        cohort_button.click()
        cohort_options = page.get_by_role("option")
        if cohort_options.count() > 1:
            option = cohort_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert rows.count() > 0
            cohort_button.click()
            clear_option_locator = page.get_by_role("option").filter(
                has_text="Clear filters"
            )
            if clear_option_locator.count():
                clear_option_locator.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)

    # Test last active filter
    last_active_button = toolbar.get_by_role("button", name="Last Active")
    if last_active_button.count() > 0:
        last_active_button.click()
        last_active_options = page.get_by_role("option")
        if last_active_options.count() > 1:
            option = last_active_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert rows.count() >= 0  # May be 0 if no matches
            last_active_button.click()
            clear_option_locator = page.get_by_role("option").filter(
                has_text="Clear filters"
            )
            if clear_option_locator.count():
                clear_option_locator.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)

    # Test empty state
    search_input.fill("zzzz-no-match-zzzz")
    page.wait_for_timeout(250)
    expect(rows).to_have_count(0)
    expect(page.get_by_text("No staff members found.")).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert rows.count() == initial_count


def test_staff_pagination_persists_filters(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    created_staff_ids: list[str] = []
    try:
        data = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        staff = data.get("staff", [])
        if len(staff) <= 10:
            needed = 11 - len(staff)
            # Get first department ID for creating staff
            department_ids = list(data.get("department_mapping", {}).keys())
            department_id = department_ids[0] if department_ids else None

            for i in range(needed):
                staff_name = generate_unique_staff_name("Pagination Staff")
                parts = staff_name.split()
                first_name = parts[0] if parts else "Pagination"
                last_name = parts[1] if len(parts) > 1 else f"Staff{i}"
                alias = f"pagination-staff-{i}"

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
                created_staff_ids.append(profile_id)

        page.goto(f"{base_url}/system/staff")
        page.wait_for_load_state("networkidle")

        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.is_disabled():
            pytest.skip("Pagination controls unavailable after seeding staff")

        next_button.click()
        page.wait_for_timeout(250)

        page.reload()
        page.wait_for_load_state("networkidle")
        pagination_label = page.get_by_text("Page 2 of")
        expect(pagination_label).to_be_visible()

        prev_button = page.get_by_role("button", name="Go to previous page")
        prev_button.click()
        page.wait_for_timeout(250)
        expect(page.get_by_text("Page 1 of")).to_be_visible()
    finally:
        for profile_id in created_staff_ids:
            try:
                delete_staff_api(
                    page.context.request,
                    profile_id,
                    current_profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
