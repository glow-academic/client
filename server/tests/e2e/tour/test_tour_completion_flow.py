"""E2E tests for tour completion flow."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_tour_completion_flow(page: Page, base_url: str) -> None:
    """Test complete TA tour steps: home overview → cohort leaderboard → practice simulation → send message → end chat."""
    # Navigate to home page
    page.goto(f"{base_url}/home")
    page.wait_for_load_state("networkidle")

    # Click tour guide button to start tour
    guide_button = page.get_by_test_id("tour-guide-button")
    guide_button.wait_for(state="visible", timeout=15000)
    guide_button.click()

    # Wait for tour to open
    # Tour might show as a modal or overlay
    # Look for tour step indicators or tour content
    page.wait_for_timeout(1000)  # Give tour time to initialize

    # Step 0: Home overview
    # The tour should be showing step 0 (home overview)
    # Verify tour is visible (might be a modal or overlay)
    # Tour step content might be in a specific container
    # For now, we'll verify by checking if we can see tour navigation buttons

    # Look for next button or step indicator
    # The exact selectors depend on the tour implementation
    # Try to find tour navigation buttons
    next_button = page.locator("button").filter(has_text="Next")
    if next_button.count() > 0:
        # Complete step 0 and move to step 1
        next_button.first.click()
        page.wait_for_timeout(1000)

    # Step 1: Navigate to cohort leaderboard
    # Tour should navigate to leaderboard page
    page.wait_for_url(re.compile(r".*/leaderboard"), timeout=10000)
    page.wait_for_load_state("networkidle")

    # Verify leaderboard page loaded
    # Look for leaderboard content
    leaderboard_content = page.locator("[data-testid='leaderboard']")
    if leaderboard_content.count() == 0:
        # Try alternative selector
        leaderboard_content = page.get_by_text("Leaderboard", exact=False)
    leaderboard_content.first.wait_for(state="visible", timeout=10000)

    # Move to next step (step 2: practice simulation)
    next_button = page.locator("button").filter(has_text="Next")
    if next_button.count() > 0:
        next_button.first.click()
        page.wait_for_timeout(1000)

    # Step 2: Navigate to practice and start simulation
    # Tour should navigate to practice page
    page.wait_for_url(re.compile(r".*/practice"), timeout=10000)
    page.wait_for_load_state("networkidle")

    # Wait for practice page to load
    practice_grid = page.get_by_test_id("practice-simulation-grid")
    practice_grid.wait_for(state="visible", timeout=15000)

    # Tour should automatically start a practice simulation
    # Wait for navigation to attempt page
    page.wait_for_url(re.compile(r".*/practice/a/[^/]+"), timeout=30000)
    page.wait_for_load_state("networkidle")

    # Verify attempt page loaded
    chat_container = page.get_by_test_id("attempt-chat-container")
    chat_container.wait_for(state="visible", timeout=15000)

    # Step 3: Send message
    # Tour should click a starter prompt or wait for user to send message
    # Look for starter prompts
    starter_prompts = page.locator("button").filter(
        has=page.locator("[class*='outline'][class*='h-auto'][class*='p-4']")
    )

    if starter_prompts.count() > 0:
        # Click first starter prompt
        starter_prompts.first.click()
        page.wait_for_timeout(2000)
    else:
        # If no starter prompts, type a message manually
        chat_input = page.get_by_test_id("attempt-chat-input")
        chat_input.fill("Hello, this is a test message.")
        send_button = page.locator("button[type='submit']").first
        send_button.click()
        page.wait_for_timeout(2000)

    # Wait for response
    messages_container = page.get_by_test_id("attempt-messages-container")
    messages_container.wait_for(state="visible", timeout=10000)

    # Wait for response message to appear
    page.wait_for_timeout(5000)  # Give time for response

    # Step 4: End chat
    # Look for end chat button
    end_chat_button = page.locator("[data-tour-end-chat]")
    if end_chat_button.count() > 0:
        end_chat_button.click()
        page.wait_for_timeout(2000)
    else:
        # Try alternative selector for end chat button
        end_chat_button = page.locator("button").filter(has_text="End")
        if end_chat_button.count() > 0:
            end_chat_button.first.click()
            page.wait_for_timeout(2000)

    # Tour should complete and navigate back to home
    page.wait_for_url(re.compile(r".*/home"), timeout=10000)
    page.wait_for_load_state("networkidle")

    # Verify tour is closed (guide button should be visible again)
    guide_button = page.get_by_test_id("tour-guide-button")
    expect(guide_button).to_be_visible()
