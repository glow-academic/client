"""E2E test validating cache behavior and revalidation across cohort flows."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.cohorts.helpers import (
    delete_cohort_api,
    fetch_cohorts_list,
    generate_unique_cohort_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message).first
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        fallback = page.get_by_text(message, exact=False).first
        fallback.wait_for(state="visible", timeout=5000)
        toast = fallback
    expect(toast).to_be_visible()


def _set_request_counter(
    page: Page, pattern: str
) -> tuple[dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request: Any) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_cohort_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="cohort-card"]'))
        .map(el => el.dataset.cohortId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_cohorts_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Ensure default detail fetch happens once and mutations revalidate list data."""
    detail_counter, stop_counter = _set_request_counter(
        page, "/api/v4/artifacts/cohorts/new"
    )
    page.goto(f"{base_url}/cohorts/new")
    page.wait_for_load_state("networkidle")
    stop_counter()
    assert detail_counter["total"] <= 1, (
        "Default cohort detail endpoint fetched more than once"
    )

    cohort_name = generate_unique_cohort_name("Cache Cohort")

    name_input = page.get_by_test_id("input-cohort-title")
    name_input.wait_for(state="visible", timeout=15000)
    name_input.fill(cohort_name)

    description_input = page.get_by_test_id("input-cohort-description")
    description_input.fill("Cohort created for cache revalidation test.")

    submit_button = page.get_by_test_id("btn-submit-cohort")
    submit_button.click()

    page.wait_for_url(f"{base_url}/cohorts", timeout=20000)
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("cohorts-search")
    search_input.fill(cohort_name)
    page.wait_for_timeout(250)

    cohorts_data = fetch_cohorts_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    created_entry = next(
        c for c in cohorts_data.get("cohorts", []) if c.get("name") == cohort_name
    )
    cohort_id = created_entry["cohort_id"]

    cohort_card = page.locator(
        f"[data-testid='cohort-card'][data-cohort-id='{cohort_id}']"
    )
    expect(cohort_card).to_be_visible()

    existing_ids = _collect_cohort_ids(page)

    duplicate_button = cohort_card.locator("[data-testid='btn-duplicate-cohort']")
    if duplicate_button.count() == 0:
        pytest.skip("No duplicate permission for this cohort")
    duplicate_button.click()
    page.wait_for_timeout(500)

    ids_after_duplicate = _collect_cohort_ids(page)
    new_ids = ids_after_duplicate - existing_ids
    assert new_ids, "Duplicate cohort card did not appear in UI"
    copy_id = new_ids.pop()

    copy_card = page.locator(f"[data-testid='cohort-card'][data-cohort-id='{copy_id}']")
    expect(copy_card).to_be_visible()
    copy_name = copy_card.inner_text().splitlines()[0].strip()

    search_input.fill(cohort_name)
    page.wait_for_timeout(250)

    edit_button = page.locator(
        f"[data-testid='cohort-card'][data-cohort-id='{cohort_id}']"
    ).get_by_test_id(f"edit-{cohort_id}")
    if edit_button.count() > 0:
        edit_button.click()

        page.wait_for_url(f"{base_url}/cohorts/e/{cohort_id}")
        page.wait_for_load_state("networkidle")

        updated_name = f"{cohort_name} Updated"
        name_input = page.get_by_test_id("input-cohort-title")
        expect(name_input).to_be_enabled()
        name_input.fill(updated_name)

        submit_button = page.get_by_test_id("btn-submit-cohort")
        submit_button.click()

        page.wait_for_url(f"{base_url}/cohorts", timeout=20000)
        page.wait_for_load_state("networkidle")

        search_input = page.get_by_test_id("cohorts-search")
        search_input.fill(updated_name)
        page.wait_for_timeout(250)

        updated_card = page.locator(
            f"[data-testid='cohort-card'][data-cohort-id='{cohort_id}']"
        )
        expect(updated_card).to_be_visible()

        delete_button = updated_card.get_by_test_id(f"delete-{cohort_id}")
        if delete_button.count() > 0:
            delete_button.click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            expect(confirm_button).to_be_enabled()
            confirm_button.click()
            page.wait_for_timeout(500)
            expect(updated_card).to_have_count(0)
    else:
        # If no edit permission, just delete the original cohort
        delete_button = cohort_card.get_by_test_id(f"delete-{cohort_id}")
        if delete_button.count() > 0:
            delete_button.click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            expect(confirm_button).to_be_enabled()
            confirm_button.click()
            page.wait_for_timeout(500)

    # Cleanup: Delete copy if it still exists
    search_input.fill(copy_name)
    page.wait_for_timeout(250)
    copy_card = page.locator(f"[data-testid='cohort-card'][data-cohort-id='{copy_id}']")
    if copy_card.count() > 0:
        delete_button = copy_card.get_by_test_id(f"delete-{copy_id}")
        if delete_button.count() > 0:
            delete_button.click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            expect(confirm_button).to_be_enabled()
            confirm_button.click()
            page.wait_for_timeout(500)
        else:
            # Fallback: Delete via API
            delete_cohort_api(
                page.context.request,
                copy_id,
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
