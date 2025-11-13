"""E2E test for duplicating agents and refreshing list."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_agent_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="agent-card"]'))
        .map(el => el.dataset.agentId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_agent_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Duplicate an agent and verify new card appears with refreshed data."""
    page.goto(f"{base_url}/management/agents")
    page.wait_for_load_state("networkidle")

    cards = page.get_by_test_id("agent-card")
    initial_count = cards.count()
    if initial_count == 0:
        pytest.skip("No agents available to duplicate")

    existing_ids = _get_agent_ids(page)

    agent_card = cards.first
    expect(agent_card).to_be_visible()
    duplicate_button = agent_card.get_by_test_id("btn-duplicate-agent")
    expect(duplicate_button).to_be_enabled()
    duplicate_button.click()
    page.wait_for_timeout(500)

    new_ids = _get_agent_ids(page)
    diff_ids = new_ids - existing_ids
    assert diff_ids, "Duplicate agent ID not found in UI"
    new_agent_id = diff_ids.pop()

    copy_card = page.locator(
        f"[data-testid='agent-card'][data-agent-id='{new_agent_id}']"
    )
    expect(copy_card).to_be_visible()

    # Cleanup: delete the duplicated agent via UI.
    copy_card.get_by_test_id("btn-delete-agent").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    confirm_button.wait_for(state="visible", timeout=5000)
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)

