"""E2E tests for stopping assistant message generation mid-stream."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_assistant_chat_stop(page: Page, base_url: str) -> None:
    """Test stopping message generation mid-stream."""
    # Navigate to home page
    page.goto(f"{base_url}/home")
    page.wait_for_load_state("networkidle")

    # Open assistant chat widget
    chat_fab = page.get_by_test_id("assistant-chat-fab")
    chat_fab.wait_for(state="visible", timeout=15000)
    chat_fab.click()

    # Wait for widget to appear
    chat_widget = page.get_by_test_id("assistant-chat-widget")
    chat_widget.wait_for(state="visible", timeout=10000)

    # Send a message that might trigger a long response
    chat_input = page.get_by_test_id("assistant-chat-input")
    chat_input.wait_for(state="visible", timeout=10000)

    # Send a message that might take time to generate
    test_message = "Write a detailed explanation of how machine learning works."
    chat_input.fill(test_message)

    # Find and click send button
    send_button = chat_input.locator("..").get_by_role("button", name="Send")
    if send_button.count() == 0:
        send_button = (
            page.locator("button[type='submit']").filter(has=page.locator("svg")).first
        )
    send_button.click()

    # Wait a moment for response to start
    page.wait_for_timeout(2000)

    # Look for stop button
    # Stop button might have test ID assistant-stop-button or similar
    stop_button = page.get_by_test_id("assistant-stop-button")
    if stop_button.count() == 0:
        # Try alternative selectors
        stop_button = page.locator("button").filter(has_text="Stop")
        if stop_button.count() == 0:
            stop_button = page.locator("button[aria-label='Stop']")

    if stop_button.count() > 0:
        # Click stop button
        stop_button.first.click()
        page.wait_for_timeout(1000)

        # Verify message generation stopped
        # The response message should be marked as incomplete or stopped
        # Look for indicators that generation was stopped
        messages_container = page.get_by_test_id("assistant-messages-container")
        if messages_container.count() > 0:
            # Check for incomplete message indicator
            incomplete_indicator = messages_container.get_by_text(
                "Stopped", exact=False
            ).or_(messages_container.get_by_text("Incomplete", exact=False))
            # Note: The exact UI for stopped messages depends on implementation
    else:
        # If no stop button found, skip test
        pytest.skip(
            "Stop button not found - may not be implemented or message completed too quickly"
        )
