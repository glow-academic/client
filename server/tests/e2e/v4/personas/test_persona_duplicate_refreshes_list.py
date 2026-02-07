"""E2E test for duplicating personas and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_persona_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="persona-card"]'))
        .map(el => el.dataset.personaId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_persona_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate a persona and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/training/personas")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("persona-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No personas available to duplicate")

    existing_ids = _get_persona_ids(page)

    persona_card = cards.first
    expect(persona_card).to_be_visible()
    duplicate_button = persona_card.get_by_test_id("btn-duplicate-persona")
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_persona_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate persona ID not found in UI"
    new_persona_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{new_persona_id}']"
    )
    expect(copy_card).to_be_visible()

    # Cleanup: delete the duplicated persona via UI.
    copy_card.get_by_test_id("btn-delete-persona").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    confirm_button.wait_for(state="visible", timeout=5000)
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)
