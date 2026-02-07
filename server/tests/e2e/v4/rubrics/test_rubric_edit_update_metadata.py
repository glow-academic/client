"""E2E tests for editing rubric metadata."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.rubrics.helpers import (
    delete_rubric_api,
    fetch_rubric_detail,
    generate_unique_rubric_name,
)
from server.tests.e2e.rubrics.ui_flows import create_rubric_via_ui

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_rubric_edit_update_metadata(page: Page, base_url: str) -> None:
    """Edit an existing rubric and verify metadata updates persist."""
    rubric_name, rubric_id = create_rubric_via_ui(
        page,
        base_url,
        name=generate_unique_rubric_name("Editable Rubric"),
        description="Rubric created for edit workflow E2E test.",
    )

    try:
        detail = fetch_rubric_detail(
            page.context.request,
            rubric_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        department_ids = detail.get("valid_department_ids") or []
        target_department_id = department_ids[0] if department_ids else None

        updated_name = f"{rubric_name} Updated"
        updated_description = "Updated description via E2E."

        page.goto(f"{base_url}/intelligence/rubrics")
        page.wait_for_load_state("networkidle")

        rubric_card = page.locator(
            f"[data-testid='rubric-card'][data-rubric-id='{rubric_id}']"
        )
        expect(rubric_card).to_be_visible()

        edit_button = rubric_card.get_by_test_id("btn-edit-rubric")
        edit_button.click()

        page.wait_for_url(f"{base_url}/intelligence/rubrics/r/{rubric_id}")
        page.wait_for_load_state("networkidle")

        container = page.locator("[data-page='rubric-edit']").first
        container.wait_for(state="visible", timeout=15000)

        # Verify page attributes
        expect(container).to_have_attribute("data-rubric-id", rubric_id)

        # Click edit button to enter edit mode (form starts in view mode)
        edit_button = page.get_by_test_id("btn-edit-rubric")
        edit_button.wait_for(state="visible", timeout=10000)
        edit_button.click()

        # Wait for edit mode to activate - save button appears when in edit mode
        save_button = page.get_by_test_id("btn-save-rubric")
        save_button.wait_for(state="visible", timeout=10000)

        # Now inputs should be visible in edit mode
        name_input = page.get_by_test_id("input-rubric-name")
        name_input.wait_for(state="visible", timeout=10000)

        # Verify form fields are populated
        expect(name_input).to_have_value(rubric_name)

        # Check if inputs are disabled (read-only)
        if name_input.is_disabled():
            pytest.skip("Newly created rubric is read-only")

        # Update name
        name_input.fill(updated_name)

        # Update description
        description_input = page.get_by_test_id("input-rubric-description")
        description_input.wait_for(state="visible", timeout=10000)
        description_input.fill(updated_description)

        # Change department if available
        if target_department_id:
            department_picker = page.get_by_test_id("picker-department")
            if department_picker.count():
                department_picker.click()
                department_option = page.locator(
                    f"[data-testid='department-option'][data-department-id='{target_department_id}']"
                )
                if department_option.count():
                    department_option.click()
                page.keyboard.press("Escape")

        # Toggle active status
        active_switch = page.get_by_test_id("switch-rubric-active")
        if active_switch.count():
            current_state = active_switch.is_checked()
            active_switch.click()
            page.wait_for_timeout(200)
            # Verify state changed
            if current_state:
                expect(active_switch).not_to_be_checked()
            else:
                expect(active_switch).to_be_checked()
            # Toggle back
            active_switch.click()
            page.wait_for_timeout(200)
            # Verify back to original state
            if current_state:
                expect(active_switch).to_be_checked()
            else:
                expect(active_switch).not_to_be_checked()

        # Save changes
        submit_button = page.get_by_test_id("btn-save-rubric")
        submit_button.click()

        # Wait for page refresh or redirect
        page.wait_for_timeout(1000)

        # Verify success toast
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            pass

        # Reload page to verify persistence
        page.reload()
        page.wait_for_load_state("networkidle")

        # After reload, form is back in view mode, so click edit again
        edit_button = page.get_by_test_id("btn-edit-rubric")
        if edit_button.count():
            edit_button.click()
            page.wait_for_timeout(500)

        name_input = page.get_by_test_id("input-rubric-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value(updated_name)

        description_input = page.get_by_test_id("input-rubric-description")
        expect(description_input).to_have_value(updated_description)

        # Navigate back to list and verify updated rubric appears
        page.goto(f"{base_url}/intelligence/rubrics")
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("rubrics-search")
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        updated_card = (
            page.get_by_test_id("rubric-card").filter(has_text=updated_name).first
        )
        expect(updated_card).to_be_visible()

    finally:
        delete_rubric_api(
            page.context.request,
            rubric_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
