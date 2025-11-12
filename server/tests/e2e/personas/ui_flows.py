"""UI flow helpers for persona E2E tests."""

from __future__ import annotations

import re
import sys
from typing import Optional, Tuple

from playwright.sync_api import Page, expect

from server.tests.e2e.personas.helpers import generate_unique_persona_name


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


def create_persona_via_ui(
    page: Page,
    base_url: str,
    *,
    name: Optional[str] = None,
    description: str = "Persona created via UI flow.",
    prompt: str = "System prompt authored during UI flow.",
) -> Tuple[str, str]:
    """Create a persona through the UI and return (name, persona_id)."""
    persona_name = name or generate_unique_persona_name("UI Persona")

    page.goto(f"{base_url}/create/personas/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-persona-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(persona_name)

    description_input = page.get_by_test_id("input-persona-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    model_picker = page.get_by_test_id("picker-model")
    model_picker.wait_for(state="visible", timeout=15000)
    model_picker.click()
    model_option = page.get_by_role("option").nth(1)
    model_option.wait_for(state="visible", timeout=10000)
    model_option.click()

    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count():
        department_picker.click()
        department_option = page.locator("[data-testid='department-option']").first
        if department_option.count():
            department_option.click()
        page.keyboard.press("Escape")

    color_trigger = page.get_by_test_id("button-persona-color")
    color_trigger.click()
    color_option = page.locator("[data-testid='preset-color']").nth(0)
    color_option.wait_for(state="visible", timeout=5000)
    color_option.click()

    icon_trigger = page.get_by_test_id("button-persona-icon")
    icon_trigger.click()
    icon_option = page.get_by_test_id("icon-option").nth(0)
    icon_option.wait_for(state="visible", timeout=5000)
    icon_option.click()

    prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
    prompt_textarea.wait_for(state="visible", timeout=15000)
    _set_monaco_value(page, prompt)

    submit_button = page.get_by_test_id("btn-submit-persona")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/create/personas.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after persona create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='personas-grid']", timeout=10000)

    search_input = page.get_by_test_id("personas-search")
    search_input.fill(persona_name)
    page.wait_for_timeout(500)

    persona_card = page.get_by_test_id("persona-card").filter(has_text=persona_name).first
    expect(persona_card).to_be_visible()

    persona_id = persona_card.get_attribute("data-persona-id")
    if not persona_id:
        raise AssertionError("Created persona card missing data-persona-id attribute")

    return persona_name, persona_id

