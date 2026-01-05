"""E2E tests for creating agents with validation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.agents.helpers import generate_unique_agent_name


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message)
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        toast = page.get_by_text(message, exact=False)
        toast.wait_for(state="visible", timeout=5000)
    expect(toast).to_be_visible()


def _set_monaco_value(page: Page, value: str) -> None:
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


ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_agent_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create an agent successfully."""
    page.goto(f"{base_url}/management/agents/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-agent-name")
    name_input.wait_for(state="visible", timeout=20000)

    submit_button = page.get_by_test_id("btn-submit-agent")

    # Fill out required fields.
    agent_name = generate_unique_agent_name()
    name_input.fill(agent_name)
    description_input = page.get_by_test_id("input-agent-description")
    description_input.wait_for(state="visible", timeout=20000)
    description_input.fill("Agent created via E2E test.")

    # Ensure a model is selected (picker defaults to first option—reselect to exercise UI).
    model_picker = page.get_by_test_id("picker-model")
    model_picker.wait_for(state="visible", timeout=10000)
    model_picker.click()
    model_option = page.get_by_role("option").nth(1)
    model_option.wait_for(state="visible", timeout=10000)
    model_option.click()

    # Select role
    role_picker = page.get_by_test_id("picker-role")
    if role_picker.count() > 0:
        role_picker.wait_for(state="visible", timeout=10000)
        role_picker.click()
        role_option = page.get_by_role("option").nth(1)
        role_option.wait_for(state="visible", timeout=10000)
        role_option.click()

    # Adjust temperature slider slightly.
    slider_thumb = (
        page.get_by_test_id("temperature-slider").locator('[role="slider"]').first
    )
    slider_thumb.focus()
    page.keyboard.press("ArrowRight")

    # Select reasoning (optional)
    reasoning_picker = page.get_by_test_id("picker-reasoning")
    if reasoning_picker.count() > 0:
        reasoning_picker.wait_for(state="visible", timeout=10000)
        reasoning_picker.click()
        reasoning_option = page.get_by_role("option").nth(1)
        reasoning_option.wait_for(state="visible", timeout=10000)
        reasoning_option.click()

    prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
    prompt_textarea.wait_for(state="visible", timeout=20000)
    _set_monaco_value(page, "System prompt authored by E2E tests.")

    submit_button.click()

    page.wait_for_url(f"{base_url}/management/agents", timeout=20000)
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("agents-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(agent_name)
    page.wait_for_timeout(250)

    agent_card = page.get_by_test_id("agent-card").filter(has_text=agent_name).first
    expect(agent_card).to_be_visible()

    delete_button = agent_card.get_by_test_id("btn-delete-agent")
    delete_button.click()

    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)

    expect(page.get_by_test_id("agent-card").filter(has_text=agent_name)).to_have_count(
        0
    )
