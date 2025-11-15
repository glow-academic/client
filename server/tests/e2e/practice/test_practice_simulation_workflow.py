"""E2E tests for practice simulation workflow."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_practice_simulation_workflow(page: Page, base_url: str) -> None:
    """Test practice simulation chat flow."""
    page.goto(f"{base_url}/practice")
    page.wait_for_load_state("networkidle")

    # Wait for practice simulation grid to load
    practice_grid = page.get_by_test_id("practice-simulation-grid")
    practice_grid.wait_for(state="visible", timeout=15000)

    # Find a simulation card (they may be in the grid)
    simulation_cards = page.locator("[data-testid='simulation-card']")
    if simulation_cards.count() == 0:
        pytest.skip("No practice simulations available")

    first_card = simulation_cards.first
    simulation_id = first_card.get_attribute("data-simulation-id")

    if not simulation_id:
        pytest.skip("Could not find simulation ID on card")

    # Click start button for this simulation
    start_button = page.get_by_test_id(f"start-simulation-{simulation_id}")
    start_button.wait_for(state="visible", timeout=10000)

    # Set up navigation promise before clicking
    navigation_promise = page.wait_for_event("framenavigated", timeout=30000)

    start_button.click()

    # Wait for navigation to attempt page
    navigation_promise

    # Verify we navigated to the practice attempt page
    page.wait_for_url(re.compile(r".*/practice/a/[^/]+"), timeout=30000)
    page.wait_for_load_state("networkidle")

    # Verify attempt page loads with chat container
    chat_container = page.get_by_test_id("attempt-chat-container")
    chat_container.wait_for(state="visible", timeout=15000)
    expect(chat_container).to_be_visible()

    # Verify chat input is visible
    chat_input = page.get_by_test_id("attempt-chat-input")
    chat_input.wait_for(state="visible", timeout=10000)
    expect(chat_input).to_be_visible()

    # Send a test message
    test_message = "Hello, this is a practice test message."
    chat_input.fill(test_message)

    # Find and click the send button
    send_button = chat_input.locator("..").get_by_role("button", name="Send")
    if send_button.count() == 0:
        send_button = page.locator("button[type='submit']").filter(
            has=page.locator("svg")
        ).first
    send_button.click()

    # Wait for message to appear
    page.wait_for_timeout(2000)

    # Verify message appears in chat
    messages_container = page.get_by_test_id("attempt-messages-container")
    messages_container.wait_for(state="visible", timeout=10000)

    message_with_content = messages_container.get_by_text(test_message, exact=False)
    message_with_content.wait_for(state="visible", timeout=30000)

    # Wait for response message
    response_message = messages_container.locator(
        "[data-testid^='message-']"
    ).filter(has_not=page.get_by_text(test_message))
    response_message.wait_for(state="visible", timeout=60000)

    # Verify we have at least 2 messages
    all_messages = messages_container.locator("[data-testid^='message-']")
    expect(all_messages).to_have_count(2, timeout=60000)

