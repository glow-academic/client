"""E2E test validating read-only agent guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.agents.helpers import fetch_agents_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_agent_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only agents hide editing controls and disable inputs."""
    data = fetch_agents_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    agents = data.get("agents", [])
    readonly_agent = next(
        (a for a in agents if not a.get("can_edit") and a.get("agent_id")), None
    )
    if not readonly_agent:
        pytest.skip("No read-only agent available in current dataset")

    agent_id = readonly_agent["agent_id"]
    agent_name = readonly_agent["name"]

    page.goto(f"{base_url}/management/agents")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("agents-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(agent_name)
    page.wait_for_timeout(250)

    agent_card = page.locator(f"[data-testid='agent-card'][data-agent-id='{agent_id}']")
    expect(agent_card).to_be_visible()

    expect(agent_card.get_by_test_id("btn-edit-agent")).to_have_count(0)
    # Agents might not have a view button - check if it exists
    view_button = agent_card.get_by_test_id("btn-view-agent")
    if view_button.count() > 0:
        expect(view_button).to_be_visible()
        view_button.click()
    else:
        # Navigate directly to edit page
        page.goto(f"{base_url}/management/agents/a/{agent_id}")
        page.wait_for_load_state("networkidle")

    # Verify we're on the edit page
    container = page.locator("[data-page='agent-edit']").first
    container.wait_for(state="visible", timeout=15000)

    name_input = page.get_by_test_id("input-agent-name")
    expect(name_input).to_be_disabled()

    description_input = page.get_by_test_id("input-agent-description")
    expect(description_input).to_be_disabled()

    submit_button = page.get_by_test_id("btn-submit-agent")
    expect(submit_button).to_be_disabled()

    model_picker = page.get_by_test_id("picker-model")
    expect(model_picker).to_be_disabled()

    role_picker = page.get_by_test_id("picker-role")
    if role_picker.count() > 0:
        expect(role_picker).to_be_disabled()

    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count() > 0:
        expect(department_picker).to_be_disabled()

    reasoning_picker = page.get_by_test_id("picker-reasoning")
    if reasoning_picker.count() > 0:
        expect(reasoning_picker).to_be_disabled()

    temperature_slider = page.get_by_test_id("temperature-slider")
    slider_thumb = temperature_slider.locator('[role="slider"]').first
    expect(slider_thumb).to_be_disabled()
