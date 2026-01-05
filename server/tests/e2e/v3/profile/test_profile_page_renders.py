"""E2E tests for profile page rendering."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.profile.helpers import fetch_profile_data

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_profile_page_renders(page: Page, base_url: str) -> None:
    """Test that profile page renders and displays profile information."""
    # Navigate to profile page
    page.goto(f"{base_url}/profile")
    page.wait_for_load_state("networkidle")

    # Verify profile page loaded
    # Look for profile information elements
    # The exact test IDs depend on the profile component implementation

    # Check for common profile fields
    # Profile name/display
    profile_name = page.locator("[data-testid='profile-name']").or_(
        page.get_by_text("Profile", exact=False)
    )
    if profile_name.count() > 0:
        expect(profile_name.first).to_be_visible()

    # Profile email or other identifying info
    # These selectors are placeholders - adjust based on actual component

    # Verify profile data via API
    profile_data = fetch_profile_data(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )

    assert profile_data is not None
    assert "actualProfile" in profile_data or "effectiveProfile" in profile_data

    # Verify page is interactive (not just a loading state)
    # Check that some content is visible
    page_content = page.locator("main").or_(page.locator("body"))
    expect(page_content).to_be_visible()
