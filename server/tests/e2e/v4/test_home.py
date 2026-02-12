"""E2E skeleton: Home page workflow (/home → start simulation → chat flow)."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import ADMIN_PROFILE_ID, post_json, resolve_profile_ids

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_home_workflow(page: Page, base_url: str) -> None:
    """Home page: navigate → verify simulation cards → start simulation → chat → send message → receive response."""
    pytest.skip("Skeleton — not yet implemented")

    try:
        # Step 1: Navigate to home page, verify simulation cards load
        page.goto(f"{base_url}/home")
        page.wait_for_load_state("networkidle")

        simulation_cards = page.locator("[data-testid='simulation-card']")
        simulation_cards.first.wait_for(state="visible", timeout=15000)

        first_card = simulation_cards.first
        simulation_id = first_card.get_attribute("data-simulation-id")
        if not simulation_id:
            pytest.skip("No simulation cards found on home page")

        # Step 2: Start a simulation, wait for navigation to attempt page
        start_button = page.get_by_test_id(f"start-simulation-{simulation_id}")
        start_button.wait_for(state="visible", timeout=10000)

        with page.wait_for_event("framenavigated", timeout=30000):
            start_button.click()

        page.wait_for_url(re.compile(r".*/home/a/[^/]+"), timeout=30000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify chat UI renders
        chat_container = page.get_by_test_id("attempt-chat-container")
        chat_container.wait_for(state="visible", timeout=15000)
        expect(chat_container).to_be_visible()

        chat_input = page.get_by_test_id("attempt-chat-input")
        chat_input.wait_for(state="visible", timeout=10000)
        expect(chat_input).to_be_visible()

        # Step 4: Send a test message, verify it appears
        test_message = "Hello, this is a test message from E2E test."
        chat_input.fill(test_message)

        send_button = chat_input.locator("..").get_by_role("button", name="Send")
        if send_button.count() == 0:
            send_button = (
                page.locator("button[type='submit']")
                .filter(has=page.locator("svg"))
                .first
            )
        send_button.click()

        page.wait_for_timeout(2000)
        messages_container = page.get_by_test_id("attempt-messages-container")
        messages_container.wait_for(state="visible", timeout=10000)

        message_with_content = messages_container.get_by_text(
            test_message, exact=False
        )
        message_with_content.wait_for(state="visible", timeout=30000)

        # Step 5: Wait for AI response (60s timeout)
        response_message = messages_container.locator(
            "[data-testid^='message-']"
        ).filter(has_not=page.get_by_text(test_message))
        response_message.wait_for(state="visible", timeout=60000)

        all_messages = messages_container.locator("[data-testid^='message-']")
        expect(all_messages).to_have_count(2, timeout=60000)

    finally:
        pass
