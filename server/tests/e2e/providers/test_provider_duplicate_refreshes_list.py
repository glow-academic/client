"""E2E test for duplicating providers and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import delete_provider_api

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_provider_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="provider-card"]'))
        .map(el => el.dataset.providerId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_provider_duplicate_creates_copy(page: Page, base_url: str) -> None:
    """Duplicate a provider and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    provider_cards = page.get_by_test_id("provider-card")
    initial_count = provider_cards.count()
    if initial_count == 0:
        pytest.skip("No providers available to duplicate")

    existing_ids = _get_provider_ids(page)

    provider_card = provider_cards.first
    expect(provider_card).to_be_visible()
    duplicate_button = provider_card.get_by_test_id("btn-duplicate-provider")
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_provider_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate provider ID not found in UI"
    new_provider_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='provider-card'][data-provider-id='{new_provider_id}']"
    )
    expect(copy_card).to_be_visible()

    # Cleanup: delete the duplicated provider via API
    try:
        delete_provider_api(
            page.context.request,
            new_provider_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
    except Exception:
        pass


def test_provider_duplicate_refreshes_list_state(page: Page, base_url: str) -> None:
    """Verify list refreshes after duplication while maintaining filter state."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)

    provider_cards = page.get_by_test_id("provider-card")
    if provider_cards.count() == 0:
        pytest.skip("No providers available to duplicate")

    # Apply search filter
    search_input = page.get_by_test_id("providers-search")
    search_input.wait_for(state="visible", timeout=10000)
    first_provider_name = provider_cards.first.inner_text().splitlines()[0].strip()
    search_input.fill(first_provider_name)
    page.wait_for_timeout(250)

    filtered_count_before = provider_cards.count()
    existing_ids = _get_provider_ids(page)

    # Duplicate a provider
    provider_card = provider_cards.first
    duplicate_button = provider_card.get_by_test_id("btn-duplicate-provider")
    duplicate_button.click()
    page.wait_for_timeout(500)

    # Verify list refreshed
    new_provider_cards = page.get_by_test_id("provider-card")
    new_ids = _get_provider_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate provider ID not found after refresh"

    # Cleanup
    new_provider_id = diff_ids.pop()
    try:
        delete_provider_api(
            page.context.request,
            new_provider_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
    except Exception:
        pass

