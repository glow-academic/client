"""UI flow helpers for rubric E2E tests."""

from __future__ import annotations

import re
import sys
from typing import Optional, Tuple

from playwright.sync_api import Page, expect, has_text

from server.tests.e2e.rubrics.helpers import generate_unique_rubric_name


def create_rubric_via_ui(
    page: Page,
    base_url: str,
    *,
    name: Optional[str] = None,
    description: str = "Rubric created via UI flow.",
    department_ids: Optional[list[str]] = None,
    active: bool = True,
) -> Tuple[str, str]:
    """Create a rubric via UI and return (rubric_name, rubric_id) tuple."""
    rubric_name = name or generate_unique_rubric_name("UI Rubric")

    # Navigate to new rubric page
    page.goto(f"{base_url}/management/rubrics/new")
    page.wait_for_load_state("networkidle")

    # Wait for form to be ready
    name_input = page.get_by_test_id("input-rubric-name")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(rubric_name)

    description_input = page.get_by_test_id("input-rubric-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    # Select department if provided
    if department_ids:
        department_picker = page.get_by_test_id("picker-department")
        if department_picker.count():
            department_picker.click()
            # Select first available department option
            department_option = page.locator("[data-testid='department-option']").first
            if department_option.count():
                department_option.click()
            page.keyboard.press("Escape")

    # Toggle active switch if needed
    if not active:
        active_switch = page.get_by_test_id("switch-rubric-active")
        if active_switch.count():
            active_switch.click()

    # Submit form
    submit_button = page.get_by_test_id("btn-save-rubric")
    submit_button.wait_for(state="visible", timeout=10000)
    submit_button.click()

    # Wait for redirect to edit page or list page
    page.wait_for_url(
        re.compile(r".*/management/rubrics.*"), timeout=20000
    )
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after rubric create: {page.url}", file=sys.stdout)

    # Extract rubric ID from URL if on edit page
    rubric_id = ""
    if "/r/" in page.url:
        match = re.search(r"/r/([a-f0-9-]+)", page.url)
        if match:
            rubric_id = match.group(1)
    else:
        # If redirected to list, search for the rubric card
        page.wait_for_selector("[data-testid='rubrics-grid']", timeout=10000)
        search_input = page.get_by_test_id("rubrics-search")
        search_input.fill(rubric_name)
        page.wait_for_timeout(500)

        rubric_card = (
            page.get_by_test_id("rubric-card")
            .filter(has_text=rubric_name)
            .first
        )
        expect(rubric_card).to_be_visible()

        rubric_id = rubric_card.get_attribute("data-rubric-id") or ""
        if not rubric_id:
            raise AssertionError("Created rubric card missing data-rubric-id attribute")

    if not rubric_id:
        raise AssertionError("Could not determine rubric ID after creation")

    return rubric_name, rubric_id

