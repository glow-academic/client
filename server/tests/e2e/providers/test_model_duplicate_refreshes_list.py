"""E2E test for duplicating models and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import delete_model_api

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_model_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="model-card"]'))
        .map(el => el.dataset.modelId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_model_duplicate_creates_copy(page: Page, base_url: str) -> None:
    """Duplicate a model and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    model_cards = page.get_by_test_id("model-card")
    initial_count = model_cards.count()
    if initial_count == 0:
        pytest.skip("No models available to duplicate")

    existing_ids = _get_model_ids(page)

    model_card = model_cards.first
    expect(model_card).to_be_visible()
    duplicate_button = model_card.get_by_test_id("btn-duplicate-model")
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_model_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate model ID not found in UI"
    new_model_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='model-card'][data-model-id='{new_model_id}']"
    )
    expect(copy_card).to_be_visible()

    # Verify duplicate has same provider
    original_provider_id = model_card.get_attribute("data-provider-id")
    copy_provider_id = copy_card.get_attribute("data-provider-id")
    assert original_provider_id == copy_provider_id, (
        "Duplicated model should have same provider"
    )

    # Cleanup: delete the duplicated model via API
    try:
        delete_model_api(
            page.context.request,
            new_model_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
    except Exception:
        pass
