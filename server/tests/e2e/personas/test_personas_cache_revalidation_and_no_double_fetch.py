"""E2E test validating cache behavior and revalidation across persona flows."""

from __future__ import annotations

from typing import Callable, Dict

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.personas.helpers import (fetch_personas_list,
                                               generate_unique_persona_name)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message).first
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        fallback = page.get_by_text(message, exact=False).first
        fallback.wait_for(state="visible", timeout=5000)
        toast = fallback
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


def _set_request_counter(
    page: Page, pattern: str
) -> tuple[Dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)
    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_persona_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="persona-card"]'))
        .map(el => el.dataset.personaId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_personas_cache_revalidation_and_no_double_fetch(page: Page, base_url: str) -> None:
    """Ensure default detail fetch happens once and mutations revalidate list data."""
    detail_counter, stop_counter = _set_request_counter(
        page, "/api/v3/personas/detail-default"
    )
    page.goto(f"{base_url}/create/personas/new")
    page.wait_for_load_state("networkidle")
    stop_counter()
    assert (
        detail_counter["total"] <= 1
    ), "Default persona detail endpoint fetched more than once"

    persona_name = generate_unique_persona_name("Cache Persona")
    system_prompt = "Cache test system prompt content."

    name_input = page.get_by_test_id("input-persona-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(persona_name)

    description_input = page.get_by_test_id("input-persona-description")
    description_input.fill("Persona created for cache revalidation test.")

    model_picker = page.get_by_test_id("picker-model")
    model_picker.click()
    model_option = page.get_by_role("option").nth(1)
    expect(model_option).to_be_visible()
    model_option.click()

    prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
    expect(prompt_textarea).to_be_visible()
    _set_monaco_value(page, system_prompt)

    submit_button = page.get_by_test_id("btn-submit-persona")
    submit_button.click()

    _expect_toast(page, "Persona created successfully!")
    page.wait_for_url(f"{base_url}/create/personas")

    search_input = page.get_by_test_id("personas-search")
    search_input.fill(persona_name)
    page.wait_for_timeout(250)

    personas_data = fetch_personas_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    created_entry = next(
        p for p in personas_data.get("personas", []) if p.get("name") == persona_name
    )
    persona_id = created_entry["persona_id"]

    persona_card = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{persona_id}']"
    )
    expect(persona_card).to_be_visible()

    existing_ids = _collect_persona_ids(page)

    duplicate_button = persona_card.get_by_test_id("btn-duplicate-persona")
    duplicate_button.click()
    page.wait_for_timeout(500)

    ids_after_duplicate = _collect_persona_ids(page)
    new_ids = ids_after_duplicate - existing_ids
    assert new_ids, "Duplicate persona card did not appear in UI"
    copy_id = new_ids.pop()

    copy_card = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{copy_id}']"
    )
    expect(copy_card).to_be_visible()
    copy_name = copy_card.inner_text().splitlines()[0].strip()

    search_input.fill(persona_name)
    page.wait_for_timeout(250)

    edit_button = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{persona_id}']"
    ).get_by_test_id("btn-edit-persona")
    edit_button.click()

    page.wait_for_url(f"{base_url}/create/personas/p/{persona_id}")
    page.wait_for_load_state("networkidle")

    updated_name = f"{persona_name} Updated"
    name_input = page.get_by_test_id("input-persona-name")
    expect(name_input).to_be_enabled()
    name_input.fill(updated_name)

    submit_button = page.get_by_test_id("btn-submit-persona")
    submit_button.click()

    page.wait_for_url(f"{base_url}/create/personas")

    search_input = page.get_by_test_id("personas-search")
    search_input.fill(updated_name)
    page.wait_for_timeout(250)

    updated_card = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{persona_id}']"
    )
    expect(updated_card).to_be_visible()

    updated_card.get_by_test_id("btn-delete-persona").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(updated_card).to_have_count(0)

    search_input.fill(copy_name)
    page.wait_for_timeout(250)
    copy_card = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{copy_id}']"
    )
    expect(copy_card).to_be_visible()

    copy_card.get_by_test_id("btn-delete-persona").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)


