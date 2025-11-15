"""E2E test validating read-only department guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.departments.helpers import fetch_departments_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_department_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only departments hide editing controls and disable inputs."""
    data = fetch_departments_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    departments = data.get("departments", [])
    readonly_department = next(
        (d for d in departments if not d.get("can_edit") and d.get("department_id")),
        None,
    )
    if not readonly_department:
        pytest.skip("No read-only department available in current dataset")

    department_id = readonly_department["department_id"]
    department_title = readonly_department["title"]

    page.goto(f"{base_url}/system/departments")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("departments-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(department_title)
    page.wait_for_timeout(250)

    department_card = page.locator(
        f"[data-testid='department-card'][data-department-id='{department_id}']"
    )
    expect(department_card).to_be_visible()

    expect(department_card.get_by_test_id("btn-edit-department")).to_have_count(0)
    view_button = department_card.get_by_test_id("btn-view-department")
    expect(view_button).to_be_visible()

    # Verify no duplicate/delete buttons
    expect(department_card.get_by_test_id("btn-duplicate-department")).to_have_count(0)
    expect(department_card.get_by_test_id("btn-delete-department")).to_have_count(0)

    view_button.click()

    page.wait_for_url(f"{base_url}/system/departments/d/{department_id}")
    page.wait_for_load_state("networkidle")

    banner = page.get_by_text("Department is read-only")
    expect(banner).to_be_visible()

    title_input = page.get_by_test_id("input-department-title")
    expect(title_input).to_be_disabled()

    description_input = page.get_by_test_id("input-department-description")
    expect(description_input).to_be_disabled()

    submit_button = page.get_by_test_id("btn-submit-department")
    expect(submit_button).to_be_disabled()

    active_switch = page.get_by_test_id("switch-department-active")
    if active_switch.is_visible():
        expect(active_switch).to_be_disabled()
