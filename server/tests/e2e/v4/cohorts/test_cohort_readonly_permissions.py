"""E2E test validating read-only cohort guardrails."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.cohorts.helpers import fetch_cohorts_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_cohort_readonly_permissions(page: Page, base_url: str) -> None:
    """Verify read-only cohorts hide editing controls and disable inputs."""
    data = fetch_cohorts_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    cohorts = data.get("cohorts", [])
    readonly_cohort = next(
        (c for c in cohorts if not c.get("can_edit") and c.get("cohort_id")), None
    )
    if not readonly_cohort:
        pytest.skip("No read-only cohort available in current dataset")

    cohort_id = readonly_cohort["cohort_id"]
    cohort_name = readonly_cohort["name"]

    page.goto(f"{base_url}/cohorts")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("cohorts-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(cohort_name)
    page.wait_for_timeout(250)

    cohort_card = page.locator(
        f"[data-testid='cohort-card'][data-cohort-id='{cohort_id}']"
    )
    expect(cohort_card).to_be_visible()

    # Verify edit button is not shown, view button is shown instead
    edit_button = cohort_card.get_by_test_id(f"edit-{cohort_id}")
    expect(edit_button).to_have_count(0)
    view_button = cohort_card.get_by_test_id(f"view-{cohort_id}")
    if view_button.count() > 0:
        view_button.click()
    else:
        # Navigate directly to edit page
        page.goto(f"{base_url}/cohorts/e/{cohort_id}")

    page.wait_for_url(f"{base_url}/cohorts/e/{cohort_id}")
    page.wait_for_load_state("networkidle")

    # Verify readonly banner/indicator appears (if implemented)
    # Note: Cohorts may not have explicit readonly banner, but fields should be disabled

    name_input = page.get_by_test_id("input-cohort-title")
    expect(name_input).to_be_disabled()

    description_input = page.get_by_test_id("input-cohort-description")
    expect(description_input).to_be_disabled()

    # Verify pickers are disabled
    department_picker = page.get_by_test_id("picker-department")
    if department_picker.count():
        # Check if picker trigger is disabled
        picker_button = department_picker.locator("button")
        if picker_button.count():
            expect(picker_button.first).to_be_disabled()

    # Verify active switch is disabled
    active_switch = page.get_by_test_id("switch-cohort-active")
    if active_switch.count():
        expect(active_switch).to_be_disabled()

    # Verify submit button is disabled
    submit_button = page.get_by_test_id("btn-submit-cohort")
    expect(submit_button).to_be_disabled()
