"""E2E test validating cache behavior and revalidation across department flows."""

from __future__ import annotations

from typing import Callable, Dict

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.departments.helpers import (
    create_department_api,
    delete_department_api,
    fetch_departments_list,
    generate_unique_department_name,
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
) -> tuple[Dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_department_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="department-card"]'))
        .map(el => el.dataset.departmentId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_departments_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Ensure default detail fetch happens once and mutations revalidate list data."""
    detail_counter, stop_counter = _set_request_counter(
        page, "/api/v3/departments/detail-default"
    )
    page.goto(f"{base_url}/system/departments/new")
    page.wait_for_load_state("networkidle")
    stop_counter()
    assert (
        detail_counter["total"] <= 1
    ), "Default department detail endpoint fetched more than once"

    department_title = generate_unique_department_name("Cache Department")
    department_id = None
    duplicated_id = None
    try:
        # Create department via UI
        title_input = page.get_by_test_id("input-department-title")
        title_input.wait_for(state="visible", timeout=15000)
        title_input.fill(department_title)

        description_input = page.get_by_test_id("input-department-description")
        description_input.fill("Department created for cache revalidation test.")

        submit_button = page.get_by_test_id("btn-submit-department")
        submit_button.click()

        _expect_toast(page, "Department created successfully")
        page.wait_for_url(f"{base_url}/system/departments")

        # Verify list page shows new department without manual refresh
        search_input = page.get_by_test_id("departments-search")
        search_input.fill(department_title)
        page.wait_for_timeout(250)

        departments_data = fetch_departments_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        created_entry = next(
            d
            for d in departments_data.get("departments", [])
            if d.get("title") == department_title
        )
        department_id = created_entry["department_id"]

        department_card = page.locator(
            f"[data-testid='department-card'][data-department-id='{department_id}']"
        )
        expect(department_card).to_be_visible()

        existing_ids = _collect_department_ids(page)

        # Test duplicate cache revalidation
        duplicate_button = department_card.get_by_test_id("btn-duplicate-department")
        if duplicate_button.is_visible():
            duplicate_button.click()
            page.wait_for_timeout(500)

            ids_after_duplicate = _collect_department_ids(page)
            new_ids = ids_after_duplicate - existing_ids
            assert new_ids, "Duplicate department card did not appear in UI"
            duplicated_id = new_ids.pop()

            copy_card = page.locator(
                f"[data-testid='department-card'][data-department-id='{duplicated_id}']"
            )
            expect(copy_card).to_be_visible()

        # Test update cache revalidation
        edit_button = department_card.get_by_test_id("btn-edit-department")
        if edit_button.is_visible():
            edit_button.click()

            page.wait_for_url(f"{base_url}/system/departments/d/{department_id}")
            page.wait_for_load_state("networkidle")

            updated_title = generate_unique_department_name("Updated Cache Department")
            title_input = page.get_by_test_id("input-department-title")
            expect(title_input).to_be_enabled()
            title_input.fill(updated_title)

            submit_button = page.get_by_test_id("btn-submit-department")
            submit_button.click()

            page.wait_for_url(f"{base_url}/system/departments")

            search_input = page.get_by_test_id("departments-search")
            search_input.fill(updated_title)
            page.wait_for_timeout(250)

            updated_card = page.locator(
                f"[data-testid='department-card'][data-department-id='{department_id}']"
            )
            expect(updated_card).to_be_visible()

            # Test delete cache revalidation
            delete_button = updated_card.get_by_test_id("btn-delete-department")
            if delete_button.is_visible():
                delete_button.click()
                confirm_button = page.get_by_test_id("btn-confirm-delete")
                expect(confirm_button).to_be_enabled()
                confirm_button.click()
                page.wait_for_timeout(500)
                expect(updated_card).to_have_count(0)

        # Cleanup duplicated department if it exists
        if duplicated_id:
            try:
                delete_department_api(
                    page.context.request,
                    duplicated_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
    finally:
        # Ensure cleanup
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

