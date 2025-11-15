"""Reusable UI flow functions for department E2E tests."""

from __future__ import annotations

import sys

from playwright.sync_api import Page, expect

from server.tests.e2e.departments.helpers import generate_unique_department_name


def create_department_via_ui(
    page: Page,
    base_url: str,
    *,
    title: str | None = None,
    description: str = "Department created via UI flow.",
    active: bool = True,
) -> tuple[str, str]:
    """Create a department via the UI and return (department_name, department_id)."""
    department_title = title or generate_unique_department_name("UI Department")

    page.goto(f"{base_url}/system/departments/new")
    page.wait_for_load_state("networkidle")

    title_input = page.get_by_test_id("input-department-title")
    title_input.wait_for(state="visible", timeout=15000)
    title_input.fill(department_title)

    description_input = page.get_by_test_id("input-department-description")
    description_input.wait_for(state="visible", timeout=15000)
    description_input.fill(description)

    # Toggle active switch if needed
    active_switch = page.get_by_test_id("switch-department-active")
    if active_switch.is_visible():
        current_state = active_switch.is_checked()
        if current_state != active:
            active_switch.click()

    submit_button = page.get_by_test_id("btn-submit-department")
    submit_button.click()

    page.wait_for_url(f"{base_url}/system/departments", timeout=20000)
    page.wait_for_load_state("networkidle")
    print(f"[E2E] Landed on URL after department create: {page.url}", file=sys.stdout)
    page.wait_for_selector("[data-testid='departments-grid']", timeout=10000)

    search_input = page.get_by_test_id("departments-search")
    search_input.fill(department_title)
    page.wait_for_timeout(500)

    department_card = (
        page.get_by_test_id("department-card").filter(has_text=department_title).first
    )
    expect(department_card).to_be_visible()

    department_id = department_card.get_attribute("data-department-id")
    if not department_id:
        raise AssertionError(
            "Created department card missing data-department-id attribute"
        )

    return department_title, department_id
