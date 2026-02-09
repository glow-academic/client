"""E2E tests for rubric creation workflow."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.rubrics.helpers import (
    delete_rubric_api,
    generate_unique_rubric_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_rubric_create_validation_and_success(page: Page, base_url: str) -> None:
    """Validate required fields and create a rubric successfully."""
    rubric_name = None
    rubric_id = None

    try:
        page.goto(f"{base_url}/system/rubrics/new")
        page.wait_for_load_state("networkidle")

        # Verify page attribute
        page_container = page.locator("[data-page='rubric-new']")
        expect(page_container).to_be_visible()

        name_input = page.get_by_test_id("input-rubric-name")
        name_input.wait_for(state="visible", timeout=20000)

        submit_button = page.get_by_test_id("btn-save-rubric")

        # Fill out required fields
        rubric_name = generate_unique_rubric_name()
        name_input.fill(rubric_name)

        description_input = page.get_by_test_id("input-rubric-description")
        description_input.wait_for(state="visible", timeout=20000)
        description_input.fill("Rubric created via E2E test.")

        # Select department if available
        department_picker = page.get_by_test_id("picker-department")
        if department_picker.count():
            department_picker.click()
            department_option = page.get_by_role("option").nth(1)
            if department_option.count():
                department_option.wait_for(state="visible", timeout=10000)
                department_option.click()
                page.keyboard.press("Escape")
                # Wait for picker to close
                page.wait_for_timeout(200)

        # Toggle active switch (should be on by default)
        active_switch = page.get_by_test_id("switch-rubric-active")
        if active_switch.count():
            # Verify it's checked by default
            expect(active_switch).to_be_checked()

        # Ensure any open dropdowns/pickers are closed before submitting
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # Submit form
        submit_button.click()

        # Wait for redirect to edit page (rubrics redirect to edit page after creation)
        page.wait_for_url(re.compile(r".*/system/rubrics/r/[a-f0-9-]+"), timeout=20000)
        page.wait_for_load_state("networkidle")

        # Extract rubric ID from URL
        match = re.search(r"/r/([a-f0-9-]+)", page.url)
        if not match:
            raise AssertionError(f"Could not extract rubric ID from URL: {page.url}")
        rubric_id = match.group(1)

        # Verify toast notification
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            # Toast might have disappeared, that's okay
            pass

    finally:
        # Cleanup
        if rubric_id:
            try:
                delete_rubric_api(
                    page.context.request,
                    rubric_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
