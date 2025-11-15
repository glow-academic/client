"""E2E tests for practice infinite mode simulation."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_practice_infinite_mode(page: Page, base_url: str) -> None:
    """Test starting infinite mode practice simulation with time limit."""
    page.goto(f"{base_url}/practice")
    page.wait_for_load_state("networkidle")

    # Wait for practice page to load
    practice_grid = page.get_by_test_id("practice-simulation-grid")
    practice_grid.wait_for(state="visible", timeout=15000)

    # Open customize dialog
    customize_button = page.get_by_test_id("practice-customize-button")
    customize_button.wait_for(state="visible", timeout=10000)
    customize_button.click()

    # Wait for customize dialog
    customize_dialog = page.get_by_test_id("practice-customize-dialog")
    customize_dialog.wait_for(state="visible", timeout=10000)

    # Enable infinite mode (check for mode switch)
    mode_switch = page.get_by_test_id("practice-mode-switch")
    if mode_switch.count() > 0:
        # Check if infinite mode is already enabled or needs to be toggled
        # The switch might be a checkbox or toggle button
        if not mode_switch.is_checked():
            mode_switch.click()
        page.wait_for_timeout(500)

    # Set time limit for infinite mode
    time_limit_input = page.get_by_test_id("practice-time-limit-input")
    if time_limit_input.count() > 0:
        time_limit_input.fill("15")  # 15 minutes
        page.wait_for_timeout(500)

    # Select simulation
    simulation_picker = page.get_by_test_id("practice-simulation-picker")
    simulation_picker.wait_for(state="visible", timeout=10000)
    simulation_picker.click()

    simulation_options = page.get_by_role("option")
    if simulation_options.count() > 0:
        first_option = simulation_options.first
        first_option.wait_for(state="visible", timeout=5000)
        first_option.click()
    else:
        page.keyboard.press("Escape")
        pytest.skip("No simulations available")

    # Click start button
    start_button = page.get_by_test_id("practice-start-button")
    start_button.wait_for(state="visible", timeout=10000)

    # Set up navigation promise
    navigation_promise = page.wait_for_event("framenavigated", timeout=30000)

    start_button.click()

    # Wait for navigation
    navigation_promise

    # Verify navigation to attempt page
    page.wait_for_url(re.compile(r".*/practice/a/[^/]+"), timeout=30000)
    page.wait_for_load_state("networkidle")

    # Verify attempt page loads
    chat_container = page.get_by_test_id("attempt-chat-container")
    chat_container.wait_for(state="visible", timeout=15000)
    expect(chat_container).to_be_visible()

    # Verify infinite mode indicator is present (if displayed)
    # This might be shown as a badge or icon on the attempt page
    # The exact test ID would need to be verified from the component

