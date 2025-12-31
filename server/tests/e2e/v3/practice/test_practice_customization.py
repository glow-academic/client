"""E2E tests for practice page customization dialog."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.practice.helpers import fetch_practice_data

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_practice_customization_dialog(page: Page, base_url: str) -> None:
    """Test customize page flow on practice page."""
    page.goto(f"{base_url}/practice")
    page.wait_for_load_state("networkidle")

    # Wait for practice page to load
    practice_grid = page.get_by_test_id("practice-simulation-grid")
    practice_grid.wait_for(state="visible", timeout=15000)

    # Click customize button
    customize_button = page.get_by_test_id("practice-customize-button")
    customize_button.wait_for(state="visible", timeout=10000)

    # Set up navigation promise before clicking
    with page.wait_for_event("framenavigated", timeout=10000):
        customize_button.click()

    # Wait for customize page to load
    page.wait_for_url(f"{base_url}/practice/custom", timeout=10000)
    page.wait_for_load_state("networkidle")

    customize_page = page.get_by_test_id("practice-customize-page")
    customize_page.wait_for(state="visible", timeout=10000)
    expect(customize_page).to_be_visible()

    # Get practice data to find available options
    fetch_practice_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    # Select persona from picker
    persona_picker = page.get_by_test_id("practice-persona-picker")
    if persona_picker.count() > 0:
        persona_picker.click()
        persona_options = page.get_by_role("option")
        if persona_options.count() > 0:
            first_persona = persona_options.first
            first_persona.wait_for(state="visible", timeout=5000)
            first_persona.click()
        else:
            page.keyboard.press("Escape")

    # Select parameters (if parameter selector exists)
    parameter_selector = page.get_by_test_id("practice-parameter-selector")
    if parameter_selector.count() > 0:
        # Parameter selector might be a multi-select or checkbox group
        # Try clicking it to see if options appear
        parameter_selector.click()
        page.wait_for_timeout(500)
        # If options appear, select first one
        param_options = page.get_by_role("option")
        if param_options.count() > 0:
            param_options.first.click()
        else:
            page.keyboard.press("Escape")

    # Click start button
    start_button = page.get_by_test_id("practice-start-button")
    start_button.wait_for(state="visible", timeout=10000)

    # Set up navigation promise before clicking
    with page.wait_for_event("framenavigated", timeout=30000):
        start_button.click()

    # Verify we navigated to the practice attempt page
    page.wait_for_url(re.compile(r".*/practice/a/[^/]+"), timeout=30000)
    page.wait_for_load_state("networkidle")

    # Verify attempt page loads
    chat_container = page.get_by_test_id("attempt-chat-container")
    chat_container.wait_for(state="visible", timeout=15000)
    expect(chat_container).to_be_visible()
