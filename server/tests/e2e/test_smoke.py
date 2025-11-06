"""Smoke tests for E2E browser testing."""

import re

import pytest
from playwright.sync_api import Page, expect

pytestmark = pytest.mark.e2e


def test_home_renders(page: Page, base_url: str) -> None:
    """Test that the home page loads and renders correctly."""
    page.goto(f"{base_url}/")
    
    # Wait for page to load
    page.wait_for_load_state("networkidle")
    
    # Check that page has a title (non-empty)
    expect(page).to_have_title(re.compile(r".+"))
    
    # Verify we're on the login page or redirected appropriately
    # The page should either be at / (login) or /practice (if guest mode auto-redirects)
    current_url = page.url
    assert current_url.startswith(base_url), f"Expected URL to start with {base_url}, got {current_url}"


def test_guest_login_flow(page: Page, base_url: str) -> None:
    """Test guest login flow from login page."""
    page.goto(f"{base_url}/")
    
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

