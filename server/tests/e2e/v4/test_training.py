"""E2E skeleton: Training operational flows (home + practice).

Home: /home → simulation cards → start simulation → chat flow.
Practice: /practice → customize (persona, parameters) → start → chat flow.
"""

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


def test_practice_workflow(page: Page, base_url: str) -> None:
    """Practice page: navigate → verify grid → customize (persona picker, parameter selector) → start → chat → message → response."""
    pytest.skip("Skeleton — not yet implemented")

    try:
        # Step 1: Navigate to practice page, verify simulation cards load
        page.goto(f"{base_url}/practice")
        page.wait_for_load_state("networkidle")

        practice_grid = page.get_by_test_id("practice-simulation-grid")
        practice_grid.wait_for(state="visible", timeout=15000)

        simulation_cards = page.locator("[data-testid='simulation-card']")
        if simulation_cards.count() == 0:
            pytest.skip("No practice simulations available")

        # Step 2: Customization flow — click customize button
        customize_button = page.get_by_test_id("practice-customize-button")
        customize_button.wait_for(state="visible", timeout=10000)

        with page.wait_for_event("framenavigated", timeout=10000):
            customize_button.click()

        page.wait_for_url(f"{base_url}/practice/custom", timeout=10000)
        page.wait_for_load_state("networkidle")

        customize_page = page.get_by_test_id("practice-customize-page")
        customize_page.wait_for(state="visible", timeout=10000)

        # Step 3: Select persona from picker
        persona_picker = page.get_by_test_id("practice-persona-picker")
        if persona_picker.count() > 0:
            persona_picker.click()
            persona_options = page.get_by_role("option")
            if persona_options.count() > 0:
                persona_options.first.click()
            else:
                page.keyboard.press("Escape")

        # Step 4: Select parameters (if selector exists)
        parameter_selector = page.get_by_test_id("practice-parameter-selector")
        if parameter_selector.count() > 0:
            parameter_selector.click()
            page.wait_for_timeout(500)
            param_options = page.get_by_role("option")
            if param_options.count() > 0:
                param_options.first.click()
            else:
                page.keyboard.press("Escape")

        # Step 5: Start simulation
        start_button = page.get_by_test_id("practice-start-button")
        start_button.wait_for(state="visible", timeout=10000)

        with page.wait_for_event("framenavigated", timeout=30000):
            start_button.click()

        page.wait_for_url(re.compile(r".*/practice/a/[^/]+"), timeout=30000)
        page.wait_for_load_state("networkidle")

        # Step 6: Verify chat UI renders
        chat_container = page.get_by_test_id("attempt-chat-container")
        chat_container.wait_for(state="visible", timeout=15000)
        expect(chat_container).to_be_visible()

        chat_input = page.get_by_test_id("attempt-chat-input")
        chat_input.wait_for(state="visible", timeout=10000)

        # Step 7: Send a message, verify it appears
        test_message = "Hello, this is a practice test message."
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

        # Step 8: Wait for AI response (60s timeout)
        response_message = messages_container.locator(
            "[data-testid^='message-']"
        ).filter(has_not=page.get_by_text(test_message))
        response_message.wait_for(state="visible", timeout=60000)

        all_messages = messages_container.locator("[data-testid^='message-']")
        expect(all_messages).to_have_count(2, timeout=60000)

    finally:
        pass
