"""UI flow helpers for cohort E2E tests."""

from __future__ import annotations

import re
import sys
from typing import Optional, Tuple

from playwright.sync_api import Page, expect

from server.tests.e2e.cohorts.helpers import generate_unique_cohort_name


def create_cohort_via_ui(
    page: Page,
    base_url: str,
    *,
    name: Optional[str] = None,
    description: str = "Cohort created via UI flow.",
) -> Tuple[str, str]:
    """Create a cohort through the UI and return (name, cohort_id)."""
    cohort_name = name or generate_unique_cohort_name("UI Cohort")

    page.goto(f"{base_url}/cohorts/new")
    page.wait_for_load_state("networkidle")

    name_input = page.get_by_test_id("input-cohort-title")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(cohort_name)

    description_input = page.get_by_test_id("input-cohort-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    # Optional: Select department if picker is available
    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count():
        department_picker.click()
        department_option = page.locator("[data-testid='department-option']").first
        if department_option.count():
            department_option.click()
        page.keyboard.press("Escape")

    # Optional: Add simulation if picker is available
    simulation_picker = page.get_by_test_id("picker-simulation")
    if simulation_picker.count():
        simulation_picker.click()
        simulation_option = page.get_by_role("option").first
        if simulation_option.count():
            simulation_option.click()

    submit_button = page.get_by_test_id("btn-submit-cohort")
    submit_button.click()

    page.wait_for_url(re.compile(r".*/cohorts.*"), timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after cohort create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='cohorts-grid']", timeout=10000)

    search_input = page.get_by_test_id("cohorts-search")
    search_input.fill(cohort_name)
    page.wait_for_timeout(500)

    cohort_card = page.get_by_test_id("cohort-card").filter(has_text=cohort_name).first
    expect(cohort_card).to_be_visible()

    cohort_id = cohort_card.get_attribute("data-cohort-id")
    if not cohort_id:
        raise AssertionError("Created cohort card missing data-cohort-id attribute")

    return cohort_name, cohort_id

