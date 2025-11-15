"""E2E tests for home page simulation workflow."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.home.helpers import fetch_attempt_full

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_home_simulation_workflow(page: Page, base_url: str) -> None:
    """Test complete simulation workflow from home page."""
    # Navigate to home page
    page.goto(f"{base_url}/home")
    page.wait_for_load_state("networkidle")

    # Wait for simulation cards to load
    # Look for simulation cards - they may be in a carousel or grid
    simulation_cards = page.locator("[data-testid='simulation-card']")
    simulation_cards.first.wait_for(state="visible", timeout=15000)

    # Get the first simulation card and its ID
    first_card = simulation_cards.first
    simulation_id = first_card.get_attribute("data-simulation-id")

    if not simulation_id:
        pytest.skip("No simulation cards found on home page")

    # Click the start simulation button for this simulation
    start_button = page.get_by_test_id(f"start-simulation-{simulation_id}")
    start_button.wait_for(state="visible", timeout=10000)

    # Set up a promise to wait for the simulationStarted event
    # The WebSocket handler dispatches this event, which triggers navigation
    navigation_promise = page.wait_for_event("framenavigated", timeout=30000)

    start_button.click()

    # Wait for navigation to attempt page
    navigation_promise

    # Verify we navigated to the attempt page
    page.wait_for_url(re.compile(r".*/home/a/[^/]+"), timeout=30000)
    page.wait_for_load_state("networkidle")

    # Extract attempt ID from URL
    url_match = re.search(r"/home/a/([^/]+)", page.url)
    if not url_match:
        pytest.fail(f"Could not extract attempt ID from URL: {page.url}")
    attempt_id = url_match.group(1)

    # Verify attempt page loads with chat container
    chat_container = page.get_by_test_id("attempt-chat-container")
    chat_container.wait_for(state="visible", timeout=15000)
    expect(chat_container).to_be_visible()

    # Verify chat input is visible
    chat_input = page.get_by_test_id("attempt-chat-input")
    chat_input.wait_for(state="visible", timeout=10000)
    expect(chat_input).to_be_visible()

    # Send a test message
    test_message = "Hello, this is a test message from E2E test."
    chat_input.fill(test_message)

    # Find and click the send button (usually inside the input area)
    send_button = chat_input.locator("..").get_by_role("button", name="Send")
    if send_button.count() == 0:
        # Try alternative: look for send button by icon or test ID
        send_button = (
            page.locator("button[type='submit']").filter(has=page.locator("svg")).first
        )
    send_button.click()

    # Wait for the message to appear in the chat
    # Messages have test IDs like message-{messageId}
    # Wait for at least one message with our content
    page.wait_for_timeout(2000)  # Give time for message to be sent

    # Verify message appears (check for message container)
    # The message might take a moment to appear, so we wait
    messages_container = page.get_by_test_id("attempt-messages-container")
    messages_container.wait_for(state="visible", timeout=10000)

    # Look for our message content in the messages
    # Note: The exact test ID format may vary, so we check for content
    message_with_content = messages_container.get_by_text(test_message, exact=False)
    message_with_content.wait_for(state="visible", timeout=30000)

    # Wait for response message to appear
    # Response messages have type="response" in their data attributes
    # We wait for a message that's not our query
    response_message = messages_container.locator("[data-testid^='message-']").filter(
        has_not=page.get_by_text(test_message)
    )
    response_message.wait_for(state="visible", timeout=60000)  # Responses can take time

    # Verify we have at least 2 messages (our query + response)
    all_messages = messages_container.locator("[data-testid^='message-']")
    expect(all_messages).to_have_count(2, timeout=60000)

    # Verify attempt data via API
    attempt_data = fetch_attempt_full(
        page.context.request,
        attempt_id,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    assert attempt_data is not None
    assert attempt_data.get("attempt") is not None
    assert attempt_data["attempt"]["id"] == attempt_id
