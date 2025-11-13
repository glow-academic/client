"""E2E test for duplicating parameters and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_parameter_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="parameter-card"]'))
        .map(el => el.dataset.parameterId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_parameter_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate a parameter and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/management/parameters")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("parameter-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No parameters available to duplicate")

    existing_ids = _get_parameter_ids(page)

    parameter_card = cards.first
    expect(parameter_card).to_be_visible()
    duplicate_button = parameter_card.get_by_test_id("btn-duplicate-parameter")
    if duplicate_button.count() == 0:
        pytest.skip("No duplicateable parameters available")
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_parameter_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate parameter ID not found in UI"
    new_parameter_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='parameter-card'][data-parameter-id='{new_parameter_id}']"
    )
    expect(copy_card).to_be_visible()

    # Cleanup: delete the duplicated parameter via UI
    copy_card.get_by_test_id("btn-delete-parameter").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    confirm_button.wait_for(state="visible", timeout=5000)
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)

