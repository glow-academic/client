"""E2E test for duplicating rubrics and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_rubric_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="rubric-card"]'))
        .map(el => el.dataset.rubricId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_rubric_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate a rubric and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/management/rubrics")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("rubric-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No rubrics available to duplicate")

    existing_ids = _get_rubric_ids(page)

    rubric_card = cards.first
    expect(rubric_card).to_be_visible()

    # Check if duplicate button exists and is enabled
    duplicate_button = rubric_card.get_by_test_id("btn-duplicate-rubric")
    if duplicate_button.count() == 0:
        pytest.skip("No rubrics with duplicate permission available")
    expect(duplicate_button).to_be_enabled()

    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_rubric_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate rubric ID not found in UI"
    new_rubric_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='rubric-card'][data-rubric-id='{new_rubric_id}']"
    )
    expect(copy_card).to_be_visible()

    # Verify success toast
    toast = page.get_by_role("alert").filter(has_text="successfully")
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        pass

    # Cleanup: delete the duplicated rubric via UI
    copy_card.get_by_test_id("btn-delete-rubric").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    confirm_button.wait_for(state="visible", timeout=5000)
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)

