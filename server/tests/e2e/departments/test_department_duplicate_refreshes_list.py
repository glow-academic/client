"""E2E test for duplicating departments and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_department_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="department-card"]'))
        .map(el => el.dataset.departmentId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_department_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate a department and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/system/departments")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("department-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No departments available to duplicate")

    existing_ids = _get_department_ids(page)

    # Find a department with duplicate button
    duplicate_button = None
    department_card = None
    for i in range(cards.count()):
        card = cards.nth(i)
        btn = card.get_by_test_id("btn-duplicate-department")
        if btn.is_visible():
            department_card = card
            duplicate_button = btn
            break

    if not duplicate_button or not department_card:
        pytest.skip("No duplicatable department available")

    expect(department_card).to_be_visible()
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_department_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate department ID not found in UI"
    new_department_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='department-card'][data-department-id='{new_department_id}']"
    )
    expect(copy_card).to_be_visible()

    # Verify the duplicated department has "Copy" in the title
    copy_title = copy_card.inner_text()
    assert "Copy" in copy_title, "Duplicated department should have 'Copy' in title"

    # Cleanup: delete the duplicated department via UI
    copy_delete_button = copy_card.get_by_test_id("btn-delete-department")
    if copy_delete_button.is_visible():
        copy_delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.wait_for(state="visible", timeout=5000)
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(copy_card).to_have_count(0)
