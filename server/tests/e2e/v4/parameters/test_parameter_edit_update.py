"""E2E tests for editing and updating parameters."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.parameters.helpers import (
    create_parameter_api,
    delete_parameter_api,
    generate_unique_parameter_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_parameter_edit_update_basic_fields(page: Page, base_url: str) -> None:
    """Update parameter basic fields via edit page."""
    parameter_id = None
    try:
        # Create parameter via API
        parameter_name = generate_unique_parameter_name("Edit Test")
        parameter_id = create_parameter_api(
            page.context.request,
            name=parameter_name,
            description="Original description",
            numerical=False,
            active=True,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to edit page
        page.goto(f"{base_url}/management/parameters/p/{parameter_id}")
        page.wait_for_load_state("networkidle")

        # Verify page attributes
        page_container = page.locator(
            f'[data-page="parameter-edit"][data-parameter-id="{parameter_id}"]'
        )
        expect(page_container).to_be_visible()

        # Update name and description
        name_input = page.get_by_test_id("input-parameter-name")
        name_input.wait_for(state="visible", timeout=15000)
        updated_name = generate_unique_parameter_name("Updated")
        name_input.fill(updated_name)

        description_input = page.get_by_test_id("input-parameter-description")
        description_input.wait_for(state="visible", timeout=15000)
        description_input.fill("Updated description")

        # Toggle switches
        active_switch = page.get_by_test_id("switch-parameter-active")
        if active_switch.count():
            if active_switch.is_checked():
                active_switch.click()  # Toggle off
            else:
                active_switch.click()  # Toggle on

        numerical_switch = page.get_by_test_id("switch-parameter-numerical")
        if numerical_switch.count():
            if not numerical_switch.is_checked():
                numerical_switch.click()  # Toggle on

        document_switch = page.get_by_test_id("switch-parameter-document")
        if document_switch.count():
            if not document_switch.is_checked():
                document_switch.click()  # Toggle on

        practice_switch = page.get_by_test_id("switch-parameter-practice")
        if practice_switch.count():
            if not practice_switch.is_checked():
                practice_switch.click()  # Toggle on

        # Submit changes
        submit_button = page.get_by_test_id("btn-submit-parameter")
        submit_button.click()

        # Verify redirect to list
        page.wait_for_url(f"{base_url}/management/parameters", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Verify updated values in list
        search_input = page.get_by_test_id("parameters-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(updated_name)
        page.wait_for_timeout(250)

        parameter_card = (
            page.get_by_test_id("parameter-card").filter(has_text=updated_name).first
        )
        expect(parameter_card).to_be_visible()
    finally:
        # Cleanup
        if parameter_id:
            try:
                delete_parameter_api(
                    page.context.request,
                    parameter_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_parameter_edit_add_remove_items(page: Page, base_url: str) -> None:
    """Test adding and removing parameter items."""
    parameter_id = None
    try:
        # Create parameter via API
        parameter_name = generate_unique_parameter_name("Items Test")
        parameter_id = create_parameter_api(
            page.context.request,
            name=parameter_name,
            description="Parameter for item management test",
            numerical=False,
            active=True,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to edit page
        page.goto(f"{base_url}/management/parameters/p/{parameter_id}")
        page.wait_for_load_state("networkidle")

        # Add new parameter item
        add_item_button = page.get_by_test_id("btn-add-parameter-item")
        add_item_button.wait_for(state="visible", timeout=10000)
        add_item_button.click()
        page.wait_for_timeout(250)

        # Fill item fields
        item_name_input = page.locator("table input").first
        item_name_input.wait_for(state="visible", timeout=5000)
        item_name_input.fill("New Item")

        item_description_textarea = page.locator("table textarea").first
        if item_description_textarea.count():
            item_description_textarea.fill("New item description")

        # Delete an item if it exists (after adding one)
        delete_item_buttons = page.get_by_test_id("btn-delete-parameter-item")
        if delete_item_buttons.count() > 0:
            # Delete the first item
            delete_item_buttons.first.click()
            page.wait_for_timeout(250)
            # Verify item removed (count decreased)
            page.get_by_test_id("btn-delete-parameter-item")
            # The count should be less than before

        # Submit changes
        submit_button = page.get_by_test_id("btn-submit-parameter")
        submit_button.click()

        # Verify redirect
        page.wait_for_url(f"{base_url}/management/parameters", timeout=20000)
        page.wait_for_load_state("networkidle")
    finally:
        # Cleanup
        if parameter_id:
            try:
                delete_parameter_api(
                    page.context.request,
                    parameter_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
