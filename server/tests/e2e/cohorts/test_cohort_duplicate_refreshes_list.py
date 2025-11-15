"""E2E test for duplicating cohorts and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_cohort_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="cohort-card"]'))
        .map(el => el.dataset.cohortId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_cohort_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate a cohort and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/cohorts")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("cohort-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No cohorts available to duplicate")

    existing_ids = _get_cohort_ids(page)

    cohort_card = cards.first
    expect(cohort_card).to_be_visible()
    # btn-duplicate-cohort is the same for all cards, find it within the card context
    duplicate_button = cohort_card.locator("[data-testid='btn-duplicate-cohort']")
    if duplicate_button.count() == 0:
        pytest.skip("No cohorts available with duplicate permission")
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_cohort_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate cohort ID not found in UI"
    new_cohort_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='cohort-card'][data-cohort-id='{new_cohort_id}']"
    )
    expect(copy_card).to_be_visible()

    # Cleanup: delete the duplicated cohort via UI.
    delete_button = copy_card.get_by_test_id(f"delete-{new_cohort_id}")
    if delete_button.count() > 0:
        delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.wait_for(state="visible", timeout=5000)
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(copy_card).to_have_count(0)
