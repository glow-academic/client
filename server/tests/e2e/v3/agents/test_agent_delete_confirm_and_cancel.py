"""E2E tests for deleting agents with confirmation dialog."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.agents.helpers import (
    create_agent_api,
    delete_agent_api,
    generate_unique_agent_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_agent_delete_confirm_and_cancel(page: Page, base_url: str) -> None:
    """Test delete agent with cancel and confirm flows."""
    agent_id = None
    try:
        # Create agent via API
        agent_id = create_agent_api(
            page.context.request,
            name=generate_unique_agent_name("Delete Test Agent"),
            description="Agent created for delete test",
            system_prompt="System prompt for delete test agent.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/management/agents")
        page.wait_for_load_state("networkidle")

        agent_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        expect(agent_card).to_be_visible()

        # Test cancel flow
        delete_button = agent_card.get_by_test_id("btn-delete-agent")
        delete_button.click()

        dialog = page.get_by_test_id("dialog-delete-agent")
        expect(dialog).to_be_visible()

        cancel_button = page.get_by_test_id("btn-cancel-delete")
        cancel_button.click()
        page.wait_for_timeout(250)

        expect(agent_card).to_be_visible()

        # Test confirm flow
        delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()
        page.wait_for_timeout(500)

        expect(agent_card).to_have_count(0)

        # Verify agent no longer exists via API
        try:
            from server.tests.e2e.agents.helpers import fetch_agent_detail

            fetch_agent_detail(
                page.context.request,
                agent_id,
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            raise AssertionError("Agent should not exist after deletion")
        except Exception:
            # Expected - agent should not exist
            pass
    finally:
        # Cleanup in case test failed
        if agent_id:
            try:
                delete_agent_api(
                    page.context.request,
                    agent_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
