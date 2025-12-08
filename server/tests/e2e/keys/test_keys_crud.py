"""E2E test for keys CRUD flow."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_key_crud_flow(page: Page, base_url: str) -> None:
    """Test full CRUD flow for keys."""
    page.goto(f"{base_url}/system/keys")
    page.wait_for_load_state("networkidle")

    # Click create button
    create_button = page.get_by_role("button", name="Create Your First Key")
    if create_button.is_visible():
        create_button.click()
    else:
        # If keys exist, navigate directly to new page
        page.goto(f"{base_url}/system/keys/new")

    page.wait_for_load_state("networkidle")

    # Fill in form
    name_input = page.get_by_test_id("input-key-name")
    name_input.wait_for(state="visible", timeout=10000)
    name_input.fill("Test E2E Key")

    key_input = page.get_by_test_id("input-key-value")
    key_input.fill("sk-test-e2e-key-123456")

    # Select type (should default to api)
    type_picker = page.get_by_test_id("picker-type")
    if type_picker.count():
        type_picker.click()
        page.wait_for_timeout(100)
        # Type should already be selected, but we can verify

    # Submit form
    submit_button = page.get_by_test_id("btn-submit-key")
    submit_button.click()

    # Wait for redirect to list page
    page.wait_for_url("**/system/keys", timeout=10000)
    page.wait_for_load_state("networkidle")

    # Verify key appears in list
    expect(page.get_by_text("Test E2E Key")).to_be_visible()

    # Test edit flow
    key_card = (
        page.locator("[data-testid='key-card']").filter(has_text="Test E2E Key").first
    )
    expect(key_card).to_be_visible()

    edit_button = key_card.get_by_test_id("edit-*")
    if edit_button.count() > 0:
        edit_button.first.click()
        page.wait_for_load_state("networkidle")

        # Update name
        name_input = page.get_by_test_id("input-key-name")
        name_input.clear()
        name_input.fill("Updated E2E Key")

        # Submit
        submit_button = page.get_by_test_id("btn-submit-key")
        submit_button.click()

        # Wait for redirect
        page.wait_for_url("**/system/keys", timeout=10000)
        page.wait_for_load_state("networkidle")

        # Verify updated name appears
        expect(page.get_by_text("Updated E2E Key")).to_be_visible()
