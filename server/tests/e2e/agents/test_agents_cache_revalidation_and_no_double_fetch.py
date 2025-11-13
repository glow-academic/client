"""E2E tests for agents cache revalidation and no double fetch."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.agents.helpers import (
    create_agent_api,
    delete_agent_api,
    fetch_agents_list,
    generate_unique_agent_name,
)
from server.tests.e2e.agents.ui_flows import create_agent_via_ui

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _collect_agent_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="agent-card"]'))
        .map(el => el.dataset.agentId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_agents_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Verify cache revalidation works and no double fetching occurs."""
    created_agent_ids: list[str] = []
    try:
        # Initial load
        page.goto(f"{base_url}/management/agents")
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("agents-grid")
        grid.wait_for(state="visible", timeout=15000)
        expect(grid).to_be_visible()

        initial_ids = _collect_agent_ids(page)

        # Create agent via API and verify list refreshes
        agent_name = generate_unique_agent_name("Cache Test Agent")
        agent_id = create_agent_api(
            page.context.request,
            name=agent_name,
            description="Agent created for cache test",
            system_prompt="System prompt for cache test agent.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        created_agent_ids.append(agent_id)

        page.goto(f"{base_url}/management/agents")
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("agents-search")
        search_input.fill(agent_name)
        page.wait_for_timeout(500)

        agent_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        expect(agent_card).to_be_visible()

        # Duplicate agent and verify list refreshes
        existing_ids = _collect_agent_ids(page)
        duplicate_button = agent_card.get_by_test_id("btn-duplicate-agent")
        duplicate_button.click()
        page.wait_for_timeout(500)

        ids_after_duplicate = _collect_agent_ids(page)
        new_ids = ids_after_duplicate - existing_ids
        assert new_ids, "Duplicate agent card did not appear in UI"
        copy_id = new_ids.pop()
        created_agent_ids.append(copy_id)

        copy_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{copy_id}']"
        )
        expect(copy_card).to_be_visible()

        # Edit agent and verify list refreshes
        search_input.fill(agent_name)
        page.wait_for_timeout(250)

        edit_button = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        ).get_by_test_id("btn-edit-agent")
        edit_button.click()

        page.wait_for_url(f"{base_url}/management/agents/a/{agent_id}")
        page.wait_for_load_state("networkidle")

        updated_name = f"{agent_name} Updated"
        name_input = page.get_by_test_id("input-agent-name")
        expect(name_input).to_be_enabled()
        name_input.fill(updated_name)

        submit_button = page.get_by_test_id("btn-submit-agent")
        submit_button.click()

        page.wait_for_url(f"{base_url}/management/agents", timeout=20000)

        search_input = page.get_by_test_id("agents-search")
        search_input.fill(updated_name)
        page.wait_for_timeout(250)

        updated_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        expect(updated_card).to_be_visible()

        # Delete agent and verify list refreshes
        updated_card.get_by_test_id("btn-delete-agent").click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(updated_card).to_have_count(0)

        # Cleanup duplicate
        search_input.fill(agent_name)
        page.wait_for_timeout(250)
        copy_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{copy_id}']"
        )
        if copy_card.count() > 0:
            copy_card.get_by_test_id("btn-delete-agent").click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            confirm_button.click()
            page.wait_for_timeout(500)

    finally:
        # Cleanup any remaining test agents
        for agent_id in created_agent_ids:
            try:
                delete_agent_api(
                    page.context.request,
                    agent_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

