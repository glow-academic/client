"""E2E tests for creating parameters with validation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.parameters.helpers import (
    delete_parameter_api,
    generate_unique_parameter_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message)
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        toast = page.get_by_text(message, exact=False)
        toast.wait_for(state="visible", timeout=5000)
    expect(toast).to_be_visible()


def test_parameter_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create a parameter successfully."""
    page.goto(f"{base_url}/management/parameters/new")
    page.wait_for_load_state("networkidle")

    # Verify page attribute
    page_container = page.locator('[data-page="parameter-new"]')
    expect(page_container).to_be_visible()

    name_input = page.get_by_test_id("input-parameter-name")
    name_input.wait_for(state="visible", timeout=20000)

    submit_button = page.get_by_test_id("btn-submit-parameter")

    # Test validation - try to submit without required fields
    submit_button.click()
    # HTML5 validation should prevent submission
    expect(name_input).to_be_visible()

    # Fill out required fields
    parameter_name = generate_unique_parameter_name()
    name_input.fill(parameter_name)
    description_input = page.get_by_test_id("input-parameter-description")
    description_input.wait_for(state="visible", timeout=20000)
    description_input.fill("Parameter created via E2E test.")

    # Toggle switches
    active_switch = page.get_by_test_id("switch-parameter-active")
    if active_switch.count() and not active_switch.is_checked():
        active_switch.click()

    numerical_switch = page.get_by_test_id("switch-parameter-numerical")
    if numerical_switch.count() and not numerical_switch.is_checked():
        numerical_switch.click()

    document_switch = page.get_by_test_id("switch-parameter-document")
    if document_switch.count() and not document_switch.is_checked():
        document_switch.click()

    practice_switch = page.get_by_test_id("switch-parameter-practice")
    if practice_switch.count() and not practice_switch.is_checked():
        practice_switch.click()

    # Add a parameter item
    add_item_button = page.get_by_test_id("btn-add-parameter-item")
    if add_item_button.count():
        add_item_button.click()
        page.wait_for_timeout(250)

        # Fill item fields (first row in table)
        item_name_input = page.locator("table input").first
        if item_name_input.count():
            item_name_input.fill("Test Item")

            item_description_textarea = page.locator("table textarea").first
            if item_description_textarea.count():
                item_description_textarea.fill("Test item description")

            # If numerical, fill value
            numerical_switch_state = (
                numerical_switch.is_checked() if numerical_switch.count() else False
            )
            if numerical_switch_state:
                item_value_input = page.locator("table input[type='number']").first
                if item_value_input.count():
                    item_value_input.fill("42")

    submit_button.click()

    page.wait_for_url(f"{base_url}/management/parameters", timeout=20000)
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("parameters-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(parameter_name)
    page.wait_for_timeout(250)

    parameter_card = (
        page.get_by_test_id("parameter-card").filter(has_text=parameter_name).first
    )
    expect(parameter_card).to_be_visible()

    # Cleanup: delete the created parameter
    parameter_id = parameter_card.get_attribute("data-parameter-id")
    if parameter_id:
        delete_button = parameter_card.get_by_test_id("btn-delete-parameter")
        delete_button.click()

        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()
        page.wait_for_timeout(500)

        expect(
            page.get_by_test_id("parameter-card").filter(has_text=parameter_name)
        ).to_have_count(0)
    else:
        # Fallback: delete via API
        try:
            data = page.context.request.get(
                f"{base_url.replace(':3000', ':8000')}/api/v4/artifacts/parameters/list",
                headers={"X-Bypass-Cache": "1"},
            )
            if data.ok:
                params = data.json().get("parameters", [])
                for param in params:
                    if param.get("name") == parameter_name:
                        delete_parameter_api(
                            page.context.request,
                            param["parameter_id"],
                            profile_id=ADMIN_PROFILE_ID,
                            effective_profile_id=ADMIN_PROFILE_ID,
                        )
                        break
        except Exception:
            pass
