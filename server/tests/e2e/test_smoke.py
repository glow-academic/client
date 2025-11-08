"""Smoke tests for E2E browser testing."""

import re

import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e

@pytest.mark.test_profile_id("guest-profile-id")
def test_guest_login_flow(page: Page, base_url: str) -> None:
    """Test guest login flow from login page."""
    page.goto(f"{base_url}")
    
    # Wait for login page to load
    page.wait_for_load_state("networkidle")
    
    # Check that guest login button is visible
    guest_button = page.get_by_test_id("guest-login-button")
    expect(guest_button).to_be_visible()
    
    # Click guest login
    guest_button.click()
    
    # Should redirect to practice page
    page.wait_for_url(f"{base_url}/practice", timeout=10000)
    
    # Verify we're on the practice page
    expect(page).to_have_url(re.compile(r".*practice.*"))


@pytest.mark.test_profile_id("guest-profile-id")
def test_practice_page_accessible(page: Page, base_url: str) -> None:
    """Test that practice page is accessible with authenticated context."""
    # This test uses the authenticated page fixture (guest mode)
    # So we should be able to navigate directly to practice
    page.goto(f"{base_url}/practice")
    
    # Wait for page to load
    page.wait_for_load_state("networkidle")
    
    # Verify we're on the practice page
    expect(page).to_have_url(re.compile(r".*practice.*"))
    
    # Page should have some content (not an error page)
    # Check for common elements that might be on the practice page
    body = page.locator("body")
    expect(body).to_be_visible()


@pytest.mark.test_profile_id("6a2518eb-eba7-4650-aee0-d387c3fb8265")
def test_home_page_authenticated(page: Page, base_url: str) -> None:
    """Verify the home page renders for an authenticated profile."""
    page.goto(f"{base_url}/home")

    page.wait_for_load_state("networkidle")

    expect(page).to_have_url(re.compile(r".*/home.*"))
    simulation_progress = page.get_by_test_id("simulation-progress")
    simulation_progress.first.wait_for(state="visible")
    expect(simulation_progress.first).to_be_visible()

