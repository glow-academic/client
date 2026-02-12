"""E2E skeleton: Agent artifact lifecycle (/management/agents)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
    generate_unique_name,
    post_json,
    resolve_profile_ids,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _set_monaco_value(page: Page, value: str) -> None:
    """Set value in Monaco editor instance."""
    page.wait_for_function(
        """() => {
            const monaco = window.monaco;
            return !!(monaco && monaco.editor && monaco.editor.getModels && monaco.editor.getModels().length);
        }""",
        timeout=15000,
    )
    page.evaluate(
        """(value) => {
            const monaco = window.monaco;
            if (monaco?.editor) {
                const models = monaco.editor.getModels();
                if (models.length) {
                    models[0].setValue(value);
                }
            }
        }""",
        value,
    )


def test_agent_lifecycle(page: Page, base_url: str) -> None:
    """Full CRUD lifecycle: new defaults → create → detail → list → search → edit → duplicate → delete."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    request = page.context.request

    try:
        # Step 1: Fetch /new defaults via API
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )
        defaults = post_json(
            request,
            "/api/v4/artifacts/agents/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via API → get ID
        agent_name = generate_unique_name("E2E Agent")
        default_model_id = defaults.get("model_id") or ""
        if not default_model_id and defaults.get("valid_model_ids"):
            default_model_id = defaults["valid_model_ids"][0]

        data = post_json(
            request,
            "/api/v4/artifacts/agents/create",
            {
                "name": agent_name,
                "description": "Agent created via E2E lifecycle test.",
                "system_prompt": "System prompt for E2E lifecycle test.",
                "department_ids": None,
                "model_id": default_model_id,
                "role": defaults.get("role") or "assistant",
                "reasoning": defaults.get("reasoning"),
                "temperature": float(defaults.get("temperature") or 0.7),
                "active": True,
                "prompt_id": None,
            },
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
            bypass_cache=False,
        )
        agent_id = data["agentId"]
        created_ids.append(agent_id)

        # Step 3: Navigate to detail page → verify fields rendered
        page.goto(f"{base_url}/management/agents/{agent_id}")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-agent-name")
        name_input.wait_for(state="visible", timeout=20000)
        expect(name_input).to_have_value(agent_name)

        # Step 4: Navigate to list page → verify card visible
        page.goto(f"{base_url}/management/agents")
        page.wait_for_load_state("networkidle")
        grid = page.get_by_test_id("agents-grid")
        grid.wait_for(state="visible", timeout=15000)
        agent_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        expect(agent_card).to_be_visible()

        # Step 5: Search → verify filters to our item
        search_input = page.get_by_test_id("agents-search")
        search_input.fill(agent_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("agent-card").filter(has_text=agent_name)
        ).to_have_count(1)

        # Step 6: Edit → update a field, submit, verify change
        agent_card.click()
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-agent-name")
        name_input.wait_for(state="visible", timeout=20000)
        updated_name = generate_unique_name("E2E Agent Edited")
        name_input.fill(updated_name)
        submit_button = page.get_by_test_id("btn-submit-agent")
        submit_button.click()
        page.wait_for_url(f"{base_url}/management/agents", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 7: Duplicate → verify copy appears
        agent_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        duplicate_button = agent_card.get_by_test_id("btn-duplicate-agent")
        duplicate_button.click()
        page.wait_for_timeout(1000)
        # Find the duplicate card (has the same name with "Copy" or similar)
        duplicate_cards = page.get_by_test_id("agent-card").filter(
            has_text=updated_name
        )
        assert duplicate_cards.count() >= 2

        # Step 8: Delete duplicate → confirm dialog → verify gone
        # Find the duplicate (not the original)
        all_cards = page.get_by_test_id("agent-card").filter(has_text=updated_name)
        if all_cards.count() > 1:
            dup_card = all_cards.nth(1)
            dup_id = dup_card.get_attribute("data-agent-id")
            if dup_id:
                created_ids.append(dup_id)
            delete_button = dup_card.get_by_test_id("btn-delete-agent")
            delete_button.click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            confirm_button.click()
            page.wait_for_timeout(500)

        # Step 9: Delete original → confirm dialog → verify gone
        agent_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        delete_button = agent_card.get_by_test_id("btn-delete-agent")
        delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(agent_card).to_have_count(0)

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v4/artifacts/agents/delete",
                    {"agentId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
