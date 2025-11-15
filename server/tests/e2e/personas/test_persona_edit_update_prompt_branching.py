"""E2E tests for editing personas and managing prompts."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.personas.helpers import (
    delete_persona_api,
    fetch_persona_detail,
    generate_unique_persona_name,
)
from server.tests.e2e.personas.ui_flows import create_persona_via_ui


ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


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


def test_persona_edit_update_prompt_branching(page: Page, base_url: str) -> None:
    """Edit an existing persona, branch prompts, and verify persistence."""
    persona_name, persona_id = create_persona_via_ui(
        page,
        base_url,
        name=generate_unique_persona_name("Editable Persona"),
        description="Persona created for edit workflow E2E test.",
        prompt="Initial prompt before edits.",
    )

    detail = fetch_persona_detail(
        page.context.request,
        persona_id,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    department_ids = detail.get("valid_department_ids") or []
    target_department_id = department_ids[0] if department_ids else None
    if not target_department_id:
        pytest.skip("Persona has no departments available for prompt branching flow")

    updated_name = f"{persona_name} Updated"
    updated_prompt = "Updated default prompt content via E2E."
    department_prompt = "Department-specific prompt created via E2E."

    try:
        page.goto(f"{base_url}/create/personas")
        page.wait_for_load_state("networkidle")

        persona_card = page.locator(
            f"[data-testid='persona-card'][data-persona-id='{persona_id}']"
        )
        expect(persona_card).to_be_visible()

        edit_button = persona_card.get_by_test_id("btn-edit-persona")
        edit_button.click()

        page.wait_for_url(f"{base_url}/create/personas/p/{persona_id}")
        page.wait_for_load_state("networkidle")

        container = page.locator("[data-page='persona-edit']").first
        container.wait_for(state="visible", timeout=15000)

        name_input = page.get_by_test_id("input-persona-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value(persona_name)
        if name_input.is_disabled():
            pytest.skip("Newly created persona is read-only")
        name_input.fill(updated_name)

        slider_thumb = (
            page.get_by_test_id("temperature-slider").locator("[role='slider']").first
        )
        slider_thumb.focus()
        page.keyboard.press("ArrowRight")
        page.keyboard.press("ArrowRight")
        updated_temp = slider_thumb.get_attribute("aria-valuenow")

        prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
        prompt_textarea.wait_for(state="visible", timeout=10000)
        _set_monaco_value(page, updated_prompt)

        department_picker = page.get_by_test_id("picker-department-filter")
        department_picker.wait_for(state="visible", timeout=10000)
        department_picker.click()
        department_option = page.locator(
            f"[data-testid='department-option'][data-department-id='{target_department_id}']"
        )
        expect(department_option).to_be_visible()
        department_option.click()
        expect(page.get_by_text("Using Default Prompt")).to_be_visible()

        page.get_by_test_id("btn-create-new-prompt").click()
        _set_monaco_value(page, department_prompt)

        submit_button = page.get_by_test_id("btn-submit-persona")
        submit_button.click()

        page.wait_for_url(f"{base_url}/create/personas", timeout=20000)
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("personas-search")
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        persona_card = (
            page.get_by_test_id("persona-card").filter(has_text=updated_name).first
        )
        expect(persona_card).to_be_visible()

        edit_button = persona_card.get_by_test_id("btn-edit-persona")
        edit_button.click()

        page.wait_for_url(f"{base_url}/create/personas/p/{persona_id}")
        page.wait_for_load_state("networkidle")

        name_input = page.get_by_test_id("input-persona-name")
        expect(name_input).to_have_value(updated_name)

        if updated_temp:
            slider_thumb = (
                page.get_by_test_id("temperature-slider")
                .locator("[role='slider']")
                .first
            )
            current_temp_attr = slider_thumb.get_attribute("aria-valuenow")
            assert current_temp_attr is not None
            assert pytest.approx(float(updated_temp), rel=1e-3) == float(
                current_temp_attr
            )

        department_picker = page.get_by_test_id("picker-department-filter")
        department_picker.click()
        department_option = page.locator(
            f"[data-testid='department-option'][data-department-id='{target_department_id}']"
        )
        expect(department_option).to_be_visible()
        department_option.click()

        page.wait_for_function(
            """(expected) => {
                const monaco = window.monaco;
                if (!monaco || !monaco.editor) {
                    return false;
                }
                const models = monaco.editor.getModels?.() ?? [];
                if (!models.length) {
                    return false;
                }
                return models[0].getValue().includes(expected);
            }""",
            arg=department_prompt,
        )

        prompt_picker = page.get_by_test_id("picker-prompt")
        prompt_picker.click()
        prompt_option = page.get_by_test_id("prompt-option").filter(
            has_text=department_prompt[:25]
        )
        expect(prompt_option.first).to_be_visible()
        prompt_option.first.click()

        monaco_value = _get_monaco_value(page)
        assert department_prompt in monaco_value

    finally:
        delete_persona_api(
            page.context.request,
            persona_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
