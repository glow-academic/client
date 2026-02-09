"""E2E test for duplicating scenarios and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_scenario_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="scenario-card"]'))
        .map(el => el.dataset.scenarioId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_scenario_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate a scenario and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/training/scenarios")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("scenario-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No scenarios available to duplicate")

    existing_ids = _get_scenario_ids(page)

    scenario_card = cards.first
    expect(scenario_card).to_be_visible()
    duplicate_button = scenario_card.get_by_test_id("btn-duplicate-scenario")
    expect(duplicate_button).to_be_enabled()

    # Wait for duplicate API response
    with page.expect_response(
        lambda response: "/api/v4/artifacts/scenarios/duplicate" in response.url
    ) as response_info:
        duplicate_button.click()
    response = response_info.value
    assert response.ok, f"Duplicate API call failed with status {response.status}"

    # Wait for toast to appear (with flexible text matching)
    try:
        toast = page.get_by_role("alert").filter(has_text="duplicated")
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        # Fallback: just wait a bit if toast doesn't appear
        page.wait_for_timeout(1000)

    # Wait for router.refresh() to complete - wait for network idle after the mutation
    page.wait_for_load_state("networkidle")

    # Wait for grid to be visible and retry getting IDs in case refresh is still in progress
    grid = page.get_by_test_id("scenarios-grid")
    grid.wait_for(state="visible", timeout=10000)

    # Retry getting IDs a few times in case refresh is still in progress
    new_ids = _get_scenario_ids(page)
    retries = 0
    while not (new_ids - existing_ids) and retries < 5:
        page.wait_for_timeout(500)
        new_ids = _get_scenario_ids(page)
        retries += 1

    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate scenario ID not found in UI"
    new_scenario_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{new_scenario_id}']"
    )
    expect(copy_card).to_be_visible()

    # Cleanup: delete the duplicated scenario via UI
    copy_card.get_by_test_id("btn-delete-scenario").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    confirm_button.wait_for(state="visible", timeout=5000)
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)
