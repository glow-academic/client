"""E2E tests for editing agents and managing prompts."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.agents.helpers import (
    delete_agent_api,
    fetch_agent_detail,
    generate_unique_agent_name,
)
from server.tests.e2e.agents.ui_flows import create_agent_via_ui


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


def test_agent_edit_update_prompt_branching(page: Page, base_url: str) -> None:
    """Edit an existing agent, update fields, and test department-specific prompt branching."""
    agent_name, agent_id = create_agent_via_ui(
        page,
        base_url,
        name=generate_unique_agent_name("Editable Agent"),
        description="Agent created for edit workflow E2E test.",
        prompt="Initial prompt before edits.",
    )

    detail = fetch_agent_detail(
        page.context.request,
        agent_id,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    department_ids = detail.get("valid_department_ids") or []
    target_department_id = department_ids[0] if department_ids else None

    updated_name = f"{agent_name} Updated"
    updated_prompt = "Updated default prompt content via E2E."
    department_prompt = "Department-specific prompt created via E2E."

    try:
        page.goto(f"{base_url}/management/agents")
        page.wait_for_load_state("networkidle")

        agent_card = page.locator(
            f"[data-testid='agent-card'][data-agent-id='{agent_id}']"
        )
        expect(agent_card).to_be_visible()

        edit_button = agent_card.get_by_test_id("btn-edit-agent")
        edit_button.click()

        page.wait_for_url(f"{base_url}/management/agents/a/{agent_id}")
        page.wait_for_load_state("networkidle")

        container = page.locator("[data-page='agent-edit']").first
        container.wait_for(state="visible", timeout=15000)

        name_input = page.get_by_test_id("input-agent-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value(agent_name)
        if name_input.is_disabled():
            pytest.skip("Newly created agent is read-only")
        name_input.fill(updated_name)

        description_input = page.get_by_test_id("input-agent-description")
        description_input.fill("Updated description via E2E test.")

        # Update model if picker exists
        model_picker = page.get_by_test_id("picker-model")
        if model_picker.count() > 0:
            model_picker.click()
            model_option = page.get_by_role("option").nth(1)
            if model_option.count() > 0:
                model_option.click()

        # Update role if picker exists
        role_picker = page.get_by_test_id("picker-role")
        if role_picker.count() > 0:
            role_picker.click()
            role_option = page.get_by_role("option").nth(1)
            if role_option.count() > 0:
                role_option.click()

        # Adjust temperature
        slider_thumb = (
            page.get_by_test_id("temperature-slider").locator("[role='slider']").first
        )
        slider_thumb.focus()
        page.keyboard.press("ArrowRight")
        page.keyboard.press("ArrowRight")
        updated_temp = slider_thumb.get_attribute("aria-valuenow")

        # Update system prompt
        prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
        prompt_textarea.wait_for(state="visible", timeout=10000)
        _set_monaco_value(page, updated_prompt)

        # Test department-specific prompt branching if departments are available
        if target_department_id:
            # Look for department filter picker (for prompt branching)
            department_filter_picker = page.get_by_test_id("picker-department-filter")
            if department_filter_picker.count() > 0:
                department_filter_picker.wait_for(state="visible", timeout=10000)
                department_filter_picker.click()
                department_option = page.locator(
                    f"[data-testid='department-option'][data-department-id='{target_department_id}']"
                )
                if department_option.count() > 0:
                    expect(department_option).to_be_visible()
                    department_option.click()
                    expect(page.get_by_text("Using Default Prompt")).to_be_visible()

                    # Create new department-specific prompt
                    create_new_prompt_button = page.get_by_test_id("btn-create-new-prompt")
                    if create_new_prompt_button.count() > 0:
                        create_new_prompt_button.click()
                        _set_monaco_value(page, department_prompt)

        submit_button = page.get_by_test_id("btn-submit-agent")
        submit_button.click()

        page.wait_for_url(f"{base_url}/management/agents", timeout=20000)
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("agents-search")
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        agent_card = (
            page.get_by_test_id("agent-card").filter(has_text=updated_name).first
        )
        expect(agent_card).to_be_visible()

        edit_button = agent_card.get_by_test_id("btn-edit-agent")
        edit_button.click()

        page.wait_for_url(f"{base_url}/management/agents/a/{agent_id}")
        page.wait_for_load_state("networkidle")

        name_input = page.get_by_test_id("input-agent-name")
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

        # Verify department-specific prompt if it was created
        if target_department_id:
            department_filter_picker = page.get_by_test_id("picker-department-filter")
            if department_filter_picker.count() > 0:
                department_filter_picker.click()
                department_option = page.locator(
                    f"[data-testid='department-option'][data-department-id='{target_department_id}']"
                )
                if department_option.count() > 0:
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
                    if prompt_picker.count() > 0:
                        prompt_picker.click()
                        prompt_option = page.get_by_test_id("prompt-option").filter(
                            has_text=department_prompt[:25]
                        )
                        if prompt_option.count() > 0:
                            expect(prompt_option.first).to_be_visible()
                            prompt_option.first.click()

                            monaco_value = _get_monaco_value(page)
                            assert department_prompt in monaco_value

    finally:
        delete_agent_api(
            page.context.request,
            agent_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

