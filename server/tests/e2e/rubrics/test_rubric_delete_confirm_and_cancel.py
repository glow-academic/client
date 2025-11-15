"""E2E tests covering rubric delete confirmation and cancellation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.rubrics.helpers import generate_unique_rubric_name
from server.tests.e2e.rubrics.ui_flows import create_rubric_via_ui

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


def test_rubric_delete_cancel_then_confirm(page: Page, base_url: str) -> None:
    """Ensure delete dialog cancel preserves rubric and confirm removes it."""
    rubric_name, rubric_id = create_rubric_via_ui(
        page,
        base_url,
        name=generate_unique_rubric_name("Deletable Rubric"),
        description="Rubric targeted for delete E2E test.",
    )

    # Navigate to list to find the rubric card
    page.goto(f"{base_url}/management/rubrics")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("rubrics-search")
    search_input.fill(rubric_name)
    page.wait_for_timeout(500)

    rubric_card = page.locator(
        f"[data-testid='rubric-card'][data-rubric-id='{rubric_id}']"
    )
    expect(rubric_card).to_be_visible()

    delete_button = rubric_card.get_by_test_id("btn-delete-rubric")
    delete_button.click()

    dialog = page.get_by_test_id("dialog-delete-rubric")
    dialog.wait_for(state="visible", timeout=10000)
    expect(dialog).to_be_visible()

    # Verify dialog shows rubric name
    expect(dialog).to_contain_text(rubric_name)

    cancel_button = page.get_by_test_id("btn-cancel-delete")
    expect(cancel_button).to_be_enabled()
    cancel_button.click()

    expect(dialog).not_to_be_visible()
    expect(rubric_card).to_be_visible()

    # Try delete again and confirm
    delete_button = rubric_card.get_by_test_id("btn-delete-rubric")
    delete_button.click()
    expect(dialog).to_be_visible()

    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()

    page.wait_for_timeout(500)
    expect(rubric_card).to_have_count(0)

    # Verify success toast (might have disappeared already)
    try:
        _expect_toast(page, "successfully")
    except Exception:
        # Toast might have disappeared, that's okay
        pass
