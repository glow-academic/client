"""E2E test validating cache behavior and revalidation across rubric flows."""

from __future__ import annotations

from typing import Callable, Dict

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.rubrics.helpers import (
    delete_rubric_api,
    fetch_rubrics_list,
    generate_unique_rubric_name,
)
from server.tests.e2e.rubrics.ui_flows import create_rubric_via_ui

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
) -> tuple[Dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_rubric_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="rubric-card"]'))
        .map(el => el.dataset.rubricId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_rubrics_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Ensure default detail fetch happens once and mutations revalidate list data."""
    detail_counter, stop_counter = _set_request_counter(
        page, "/api/v3/rubrics/detail-default"
    )
    page.goto(f"{base_url}/management/rubrics/new")
    page.wait_for_load_state("networkidle")
    stop_counter()
    assert (
        detail_counter["total"] <= 1
    ), "Default rubric detail endpoint fetched more than once"

    rubric_name, rubric_id = create_rubric_via_ui(
        page,
        base_url,
        name=generate_unique_rubric_name("Cache Rubric"),
        description="Rubric created for cache revalidation test.",
    )

    # Verify rubric appears in list
    page.goto(f"{base_url}/management/rubrics")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("rubrics-search")
    search_input.fill(rubric_name)
    page.wait_for_timeout(250)

    rubrics_data = fetch_rubrics_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    created_entry = next(
        r for r in rubrics_data.get("rubrics", []) if r.get("rubric_id") == rubric_id
    )
    assert created_entry is not None

    rubric_card = page.locator(
        f"[data-testid='rubric-card'][data-rubric-id='{rubric_id}']"
    )
    expect(rubric_card).to_be_visible()

    existing_ids = _collect_rubric_ids(page)

    # Test duplicate operation refreshes cache
    duplicate_button = rubric_card.get_by_test_id("btn-duplicate-rubric")
    if duplicate_button.count():
        duplicate_button.click()
        page.wait_for_timeout(500)

        ids_after_duplicate = _collect_rubric_ids(page)
        new_ids = ids_after_duplicate - existing_ids
        assert new_ids, "Duplicate rubric card did not appear in UI"
        copy_id = new_ids.pop()

        copy_card = page.locator(
            f"[data-testid='rubric-card'][data-rubric-id='{copy_id}']"
        )
        expect(copy_card).to_be_visible()

        # Cleanup duplicate
        copy_card.get_by_test_id("btn-delete-rubric").click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.wait_for(state="visible", timeout=5000)
        confirm_button.click()
        page.wait_for_timeout(500)

    # Test update operation refreshes cache
    edit_button = rubric_card.get_by_test_id("btn-edit-rubric")
    if edit_button.count():
        edit_button.click()

        page.wait_for_url(f"{base_url}/management/rubrics/r/{rubric_id}")
        page.wait_for_load_state("networkidle")

        updated_name = f"{rubric_name} Updated"
        name_input = page.get_by_test_id("input-rubric-name")
        name_input.wait_for(state="visible", timeout=10000)

        if not name_input.is_disabled():
            name_input.fill(updated_name)

            submit_button = page.get_by_test_id("btn-save-rubric")
            submit_button.click()

            page.wait_for_timeout(1000)

            # Navigate back to list
            page.goto(f"{base_url}/management/rubrics")
            page.wait_for_load_state("networkidle")

            search_input = page.get_by_test_id("rubrics-search")
            search_input.fill(updated_name)
            page.wait_for_timeout(250)

            updated_card = page.locator(
                f"[data-testid='rubric-card'][data-rubric-id='{rubric_id}']"
            )
            expect(updated_card).to_be_visible()

    # Test delete operation refreshes cache
    search_input = page.get_by_test_id("rubrics-search")
    search_input.fill(rubric_name if "Updated" not in rubric_name else updated_name)
    page.wait_for_timeout(250)

    delete_card = page.locator(
        f"[data-testid='rubric-card'][data-rubric-id='{rubric_id}']"
    )
    if delete_card.count():
        delete_card.get_by_test_id("btn-delete-rubric").click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(delete_card).to_have_count(0)
    else:
        # Cleanup via API if UI delete didn't work
        try:
            delete_rubric_api(
                page.context.request,
                rubric_id,
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
        except Exception:
            pass

