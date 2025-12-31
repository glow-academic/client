"""UI flow helpers for agent E2E tests."""

from __future__ import annotations

import re
import sys

from playwright.sync_api import Page, expect

from server.tests.e2e.agents.helpers import generate_unique_agent_name


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


def _get_monaco_value(page: Page) -> str:
    return (
        page.evaluate(
            """() => {
                const monaco = window.monaco;
                if (!monaco || !monaco.editor) {
                    return "";
                }
                const models = monaco.editor.getModels?.() ?? [];
                if (!models.length) {
                    return "";
                }
                return models[0].getValue();
            }"""
        )
        or ""
    )


def create_agent_via_ui(
    page: Page,
    base_url: str,
    *,
    name: str | None = None,
    description: str = "Agent created via UI flow.",
    prompt: str = "System prompt authored during UI flow.",
    model_id: str | None = None,
    role: str | None = None,
    reasoning: str | None = None,
    temperature: float | None = None,
) -> tuple[str, str]:
    """Create an agent through the UI and return (name, agent_id)."""
    agent_name = name or generate_unique_agent_name("UI Agent")

    page.goto(f"{base_url}/management/agents/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-agent-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(agent_name)

    description_input = page.get_by_test_id("input-agent-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    # Select model
    model_picker = page.get_by_test_id("picker-model")
    model_picker.wait_for(state="visible", timeout=15000)
    model_picker.click()
    if model_id:
        # Try to find specific model option
        model_option = page.locator(
            f"[data-testid='model-option'][data-model-id='{model_id}']"
        )
        if model_option.count() > 0:
            model_option.first.click()
        else:
            # Fallback to nth option
            model_option = page.get_by_role("option").nth(1)
            model_option.wait_for(state="visible", timeout=10000)
            model_option.click()
    else:
        model_option = page.get_by_role("option").nth(1)
        model_option.wait_for(state="visible", timeout=10000)
        model_option.click()

    # Select role
    role_picker = page.get_by_test_id("picker-role")
    if role_picker.count() > 0:
        role_picker.wait_for(state="visible", timeout=10000)
        role_picker.click()
        if role:
            role_option = page.get_by_role("option").filter(has_text=role)
            if role_option.count() > 0:
                role_option.first.click()
            else:
                page.get_by_role("option").nth(1).click()
        else:
            page.get_by_role("option").nth(1).click()

    # Select department (optional)
    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count() > 0:
        department_picker.click()
        department_option = page.locator("[data-testid='department-option']").first
        if department_option.count():
            department_option.click()
        page.keyboard.press("Escape")

    # Select reasoning (optional)
    reasoning_picker = page.get_by_test_id("picker-reasoning")
    if reasoning_picker.count() > 0:
        reasoning_picker.wait_for(state="visible", timeout=10000)
        reasoning_picker.click()
        if reasoning:
            reasoning_option = page.get_by_role("option").filter(has_text=reasoning)
            if reasoning_option.count() > 0:
                reasoning_option.first.click()
            else:
                page.get_by_role("option").nth(0).click()
        else:
            page.get_by_role("option").nth(0).click()

    # Adjust temperature if provided
    if temperature is not None:
        slider_thumb = (
            page.get_by_test_id("temperature-slider").locator('[role="slider"]').first
        )
        slider_thumb.focus()
        # Approximate temperature adjustment via keyboard
        # This is a simplified approach - may need refinement
        current_value = float(slider_thumb.get_attribute("aria-valuenow") or "0.7")
        steps = int((temperature - current_value) * 100)
        for _ in range(abs(steps)):
            if steps > 0:
                page.keyboard.press("ArrowRight")
            else:
                page.keyboard.press("ArrowLeft")

    # Fill system prompt
    prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
    prompt_textarea.wait_for(state="visible", timeout=15000)
    _set_monaco_value(page, prompt)

    # Submit
    submit_button = page.get_by_test_id("btn-submit-agent")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/management/agents.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after agent create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='agents-grid']", timeout=10000)

    search_input = page.get_by_test_id("agents-search")
    search_input.fill(agent_name)
    page.wait_for_timeout(500)

    agent_card = page.get_by_test_id("agent-card").filter(has_text=agent_name).first
    expect(agent_card).to_be_visible()

    agent_id = agent_card.get_attribute("data-agent-id")
    if not agent_id:
        raise AssertionError("Created agent card missing data-agent-id attribute")

    return agent_name, agent_id
