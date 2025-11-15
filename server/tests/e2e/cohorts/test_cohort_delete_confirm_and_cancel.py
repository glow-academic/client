"""E2E tests covering cohort delete confirmation and cancellation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.cohorts.helpers import generate_unique_cohort_name
from server.tests.e2e.cohorts.ui_flows import create_cohort_via_ui

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


def test_cohort_delete_cancel_then_confirm(page: Page, base_url: str) -> None:
    """Ensure delete dialog cancel preserves cohort and confirm removes it."""
    cohort_name, cohort_id = create_cohort_via_ui(
        page,
        base_url,
        name=generate_unique_cohort_name("Deletable Cohort"),
        description="Cohort targeted for delete E2E test.",
    )

    cohort_card = page.locator(
        f"[data-testid='cohort-card'][data-cohort-id='{cohort_id}']"
    )
    expect(cohort_card).to_be_visible()

    delete_button = cohort_card.get_by_test_id(f"delete-{cohort_id}")
    expect(delete_button).to_be_visible()
    delete_button.click()

    dialog = page.get_by_test_id("dialog-delete-cohort")
    dialog.wait_for(state="visible", timeout=10000)
    expect(dialog).to_be_visible()

    cancel_button = page.get_by_test_id("btn-cancel-delete")
    expect(cancel_button).to_be_enabled()
    cancel_button.click()

    expect(dialog).not_to_be_visible()
    expect(cohort_card).to_be_visible()

    delete_button = cohort_card.get_by_test_id(f"delete-{cohort_id}")
    delete_button.click()
    expect(dialog).to_be_visible()

    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()

    page.wait_for_timeout(500)
    expect(cohort_card).to_have_count(0)
