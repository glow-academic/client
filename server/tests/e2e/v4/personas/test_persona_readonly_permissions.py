"""E2E test validating read-only persona guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.personas.helpers import fetch_personas_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_persona_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only personas hide editing controls and disable inputs."""
    data = fetch_personas_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    personas = data.get("personas", [])
    readonly_persona = next(
        (p for p in personas if not p.get("can_edit") and p.get("persona_id")), None
    )
    if not readonly_persona:
        pytest.skip("No read-only persona available in current dataset")

    persona_id = readonly_persona["persona_id"]
    persona_name = readonly_persona["name"]

    page.goto(f"{base_url}/training/personas")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("personas-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(persona_name)
    page.wait_for_timeout(250)

    persona_card = page.locator(
        f"[data-testid='persona-card'][data-persona-id='{persona_id}']"
    )
    expect(persona_card).to_be_visible()

    expect(persona_card.get_by_test_id("btn-edit-persona")).to_have_count(0)
    view_button = persona_card.get_by_test_id("btn-view-persona")
    expect(view_button).to_be_visible()

    view_button.click()

    page.wait_for_url(f"{base_url}/training/personas/p/{persona_id}")
    page.wait_for_load_state("networkidle")

    banner = page.get_by_text("Persona is read-only")
    expect(banner).to_be_visible()

    name_input = page.get_by_test_id("input-persona-name")
    expect(name_input).to_be_disabled()

    description_input = page.get_by_test_id("input-persona-description")
    expect(description_input).to_be_disabled()

    submit_button = page.get_by_test_id("btn-submit-persona")
    expect(submit_button).to_be_disabled()

    color_button = page.get_by_test_id("button-persona-color")
    expect(color_button).to_be_disabled()

    model_picker = page.get_by_test_id("picker-model")
    expect(model_picker).to_be_disabled()
