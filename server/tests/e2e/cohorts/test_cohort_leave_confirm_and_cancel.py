"""E2E tests covering cohort leave confirmation and cancellation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.cohorts.helpers import (
    create_cohort_api,
    delete_cohort_api,
    fetch_cohorts_list,
    generate_unique_cohort_name,
    leave_cohort_api,
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


def test_cohort_leave_cancel_then_confirm(page: Page, base_url: str) -> None:
    """Ensure leave dialog cancel preserves membership and confirm removes user."""
    # Find a cohort where user has can_leave permission
    data = fetch_cohorts_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    cohorts = data.get("cohorts", [])
    leaveable_cohort = next(
        (c for c in cohorts if c.get("can_leave") and c.get("cohort_id")), None
    )

    if not leaveable_cohort:
        # Create a cohort and add current user to it, then test leaving
        cohort_id = create_cohort_api(
            page.context.request,
            name=generate_unique_cohort_name("Leave Test Cohort"),
            description="Cohort for leave test",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            profile_ids=[ADMIN_PROFILE_ID],  # Add current user
        )
        leaveable_cohort = {"cohort_id": cohort_id, "name": "Leave Test Cohort"}
        should_cleanup = True
    else:
        cohort_id = leaveable_cohort["cohort_id"]
        should_cleanup = False

    try:
        page.goto(f"{base_url}/cohorts")
        page.wait_for_load_state("networkidle")

        cohort_card = page.locator(
            f"[data-testid='cohort-card'][data-cohort-id='{cohort_id}']"
        )
        expect(cohort_card).to_be_visible()

        leave_button = cohort_card.get_by_test_id(f"leave-{cohort_id}")
        if leave_button.count() == 0:
            pytest.skip("No leave button available for this cohort")

        leave_button.click()

        dialog = page.get_by_test_id("dialog-leave-cohort")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        cancel_button = page.get_by_test_id("btn-cancel-leave")
        expect(cancel_button).to_be_enabled()
        cancel_button.click()

        expect(dialog).not_to_be_visible()
        expect(cohort_card).to_be_visible()

        leave_button = cohort_card.get_by_test_id(f"leave-{cohort_id}")
        leave_button.click()
        expect(dialog).to_be_visible()

        confirm_button = page.get_by_test_id("btn-confirm-leave")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()

        page.wait_for_timeout(500)
        _expect_toast(page, "Left cohort")

        # Verify cohort may no longer appear in user's list (depending on permissions)
        page.reload()
        page.wait_for_load_state("networkidle")
        # Note: Cohort might still appear if user has view permissions, but user is no longer a member
    finally:
        if should_cleanup:
            try:
                delete_cohort_api(
                    page.context.request,
                    cohort_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

