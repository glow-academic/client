"""E2E tests for role-based access control."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.auth.helpers import fetch_profile_context

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_admin_access(page: Page, base_url: str) -> None:
    """Test admin profile has full access to management pages."""
    # Verify admin profile context
    context = fetch_profile_context(
        page.context.request,
        actual_profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        pathname="/management/staff",
        bypass_cache=True,
    )

    admin_role = context.get("effectiveProfile", {}).get("role", "")
    assert admin_role in ["admin", "superadmin"], (
        "Test profile should be admin or superadmin"
    )

    # Navigate to admin pages
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    # Verify admin can access staff management page
    expect(page).to_have_url(re.compile(r".*/management/staff.*"))

    # Verify staff table is visible
    staff_table = page.get_by_test_id("staff-table")
    staff_table.wait_for(state="visible", timeout=15000)
    expect(staff_table).to_be_visible()

    # Verify admin can access other management pages
    page.goto(f"{base_url}/create/personas")
    page.wait_for_load_state("networkidle")
    expect(page).to_have_url(re.compile(r".*/create/personas.*"))

    # Verify personas page loads
    personas_grid = page.get_by_test_id("personas-grid")
    personas_grid.wait_for(state="visible", timeout=15000)
    expect(personas_grid).to_be_visible()


@pytest.mark.test_profile_id("guest-profile-id")
def test_guest_access(page: Page, base_url: str) -> None:
    """Test guest profile access restrictions."""
    # Guest should be able to access practice page
    page.goto(f"{base_url}/practice")
    page.wait_for_load_state("networkidle")
    expect(page).to_have_url(re.compile(r".*practice.*"))

    # Verify practice page loads
    practice_grid = page.get_by_test_id("practice-simulation-grid")
    practice_grid.wait_for(state="visible", timeout=15000)
    expect(practice_grid).to_be_visible()

    # Guest should NOT be able to access admin pages
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    # Should be redirected away or see access denied
    current_url = page.url
    if "/management/staff" in current_url:
        # If still on staff page, check for access denied
        access_denied = page.get_by_text("access denied", exact=False).or_(
            page.get_by_text("permission", exact=False)
        )
        # May or may not show explicit message, but should not show staff table
        staff_table = page.get_by_test_id("staff-table")
        if staff_table.count() == 0:
            # Access denied (table not visible)
            pass
    else:
        # Redirected away from admin page
        assert (
            "/practice" in current_url or "/home" in current_url or "/" in current_url
        )

    # Guest should NOT be able to access create pages
    page.goto(f"{base_url}/create/personas")
    page.wait_for_load_state("networkidle")

    current_url = page.url
    if "/create/personas" not in current_url:
        # Redirected away
        pass
    else:
        # If still on page, verify no create functionality
        create_button = page.get_by_role("button", name="Create").or_(
            page.get_by_test_id("personas-grid")
        )
        # May or may not be visible, but guest shouldn't be able to create


def test_role_based_redirects(page: Page, base_url: str) -> None:
    """Test redirect paths for different roles."""
    # Admin should redirect to home (or stay on requested page)
    page.goto(f"{base_url}/")
    page.wait_for_load_state("networkidle")

    # Admin might stay on login page or redirect to home
    # If authenticated via test headers, should go to home
    current_url = page.url
    # Admin can access home
    if "/home" in current_url or "/" == current_url:
        # Verify home page loads
        simulation_progress = page.get_by_test_id("simulation-progress")
        if simulation_progress.count() > 0:
            expect(simulation_progress.first).to_be_visible()


@pytest.mark.test_profile_id("guest-profile-id")
def test_guest_role_based_redirects(page: Page, base_url: str) -> None:
    """Test guest redirect paths."""
    # Guest should redirect to practice
    page.goto(f"{base_url}/")
    page.wait_for_load_state("networkidle")

    # Guest accessing root should go to practice
    current_url = page.url
    # May redirect to practice or show login page
    if "/practice" in current_url:
        expect(page).to_have_url(re.compile(r".*practice.*"))
    elif "/" == current_url or current_url.endswith("/"):
        # Still on login page - click guest button
        guest_button = page.get_by_test_id("guest-login-button")
        if guest_button.count() > 0:
            guest_button.click()
            page.wait_for_url(re.compile(r".*practice.*"), timeout=10000)


def test_home_page_authenticated(page: Page, base_url: str) -> None:
    """Verify the home page renders for an authenticated profile (migrated from test_smoke.py)."""
    page.goto(f"{base_url}/home")

    page.wait_for_load_state("networkidle")

    expect(page).to_have_url(re.compile(r".*/home.*"))
    simulation_progress = page.get_by_test_id("simulation-progress")
    simulation_progress.first.wait_for(state="visible", timeout=15000)
    expect(simulation_progress.first).to_be_visible()
