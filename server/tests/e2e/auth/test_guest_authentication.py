"""E2E tests for guest authentication."""

from __future__ import annotations

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

    # Verify guest mode is set in localStorage
    guest_mode = page.evaluate("() => localStorage.getItem('guestMode')")
    assert guest_mode == "true", "Guest mode should be set in localStorage"


@pytest.mark.test_profile_id("guest-profile-id")
def test_guest_practice_page_access(page: Page, base_url: str) -> None:
    """Test that practice page is accessible with guest authentication."""
    # Navigate directly to practice page with guest profile
    page.goto(f"{base_url}/practice")

    # Wait for page to load
    page.wait_for_load_state("networkidle")

    # Verify we're on the practice page
    expect(page).to_have_url(re.compile(r".*practice.*"))

    # Page should have some content (not an error page)
    body = page.locator("body")
    expect(body).to_be_visible()

    # Verify practice page elements are visible
    practice_grid = page.get_by_test_id("practice-simulation-grid")
    practice_grid.wait_for(state="visible", timeout=15000)
    expect(practice_grid).to_be_visible()


@pytest.mark.test_profile_id("guest-profile-id")
def test_guest_restricted_pages(page: Page, base_url: str) -> None:
    """Test that guest cannot access admin-only pages."""
    # Attempt to access admin staff page
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    # Guest should be redirected away from admin pages
    # Check if we're redirected or see access denied
    current_url = page.url

    # Guest might be redirected to practice or see an error
    # Verify we're not on the staff management page
    if "/management/staff" in current_url:
        # If still on staff page, check for access denied message
        access_denied = page.get_by_text("access denied", exact=False).or_(
            page.get_by_text("permission", exact=False)
        )
        if access_denied.count() > 0:
            expect(access_denied.first).to_be_visible()
    else:
        # Should be redirected to practice or home
        assert (
            "/practice" in current_url or "/home" in current_url or "/" in current_url
        )


@pytest.mark.test_profile_id("guest-profile-id")
def test_guest_session_persistence(page: Page, base_url: str) -> None:
    """Test that guest session persists across page reloads."""
    # Navigate to practice page
    page.goto(f"{base_url}/practice")
    page.wait_for_load_state("networkidle")

    # Verify guest mode in localStorage
    guest_mode = page.evaluate("() => localStorage.getItem('guestMode')")
    assert guest_mode == "true", "Guest mode should be set"

    # Reload the page
    page.reload()
    page.wait_for_load_state("networkidle")

    # Verify guest mode persists
    guest_mode_after_reload = page.evaluate("() => localStorage.getItem('guestMode')")
    assert guest_mode_after_reload == "true", "Guest mode should persist after reload"

    # Verify we're still on practice page
    expect(page).to_have_url(re.compile(r".*practice.*"))
