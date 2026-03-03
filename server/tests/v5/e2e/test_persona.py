"""E2E skeleton: Persona artifact lifecycle (/training/personas)."""

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


def test_persona_lifecycle(page: Page, base_url: str) -> None:
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
            "/api/v5/artifacts/personas/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/training/personas/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-persona-name")
        name_input.wait_for(state="visible", timeout=20000)

        persona_name = generate_unique_name("E2E Persona")
        name_input.fill(persona_name)
        description_input = page.get_by_test_id("input-persona-description")
        description_input.fill("Persona created via E2E lifecycle test.")

        # Set system prompt via Monaco editor
        prompt_textarea = page.locator("[data-testid='editor-system-prompt'] textarea")
        prompt_textarea.wait_for(state="visible", timeout=20000)
        _set_monaco_value(page, "System prompt for E2E persona lifecycle test.")

        submit_button = page.get_by_test_id("btn-submit-persona")
        submit_button.click()
        page.wait_for_url(f"{base_url}/training/personas", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        persona_card = (
            page.get_by_test_id("persona-card").filter(has_text=persona_name).first
        )
        expect(persona_card).to_be_visible()
        persona_id = persona_card.get_attribute("data-persona-id")
        if persona_id:
            created_ids.append(persona_id)

        # Step 4: Search → verify filters to our item
        search_input = page.get_by_test_id("personas-search")
        search_input.fill(persona_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("persona-card").filter(has_text=persona_name)
        ).to_have_count(1)

        # Step 5: Edit → update a field, submit, verify change
        # Step 6: Duplicate → verify copy appears
        # Step 7: Delete duplicate → confirm dialog → verify gone
        # Step 8: Delete original → confirm dialog → verify gone

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v5/artifacts/personas/delete",
                    {"personaId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
