"""E2E skeleton: Rubric artifact lifecycle (/system/rubrics)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
    generate_unique_name,
    post_json,
    resolve_profile_ids,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_rubric_lifecycle(page: Page, base_url: str) -> None:
    """Full CRUD lifecycle: new defaults → create → detail → list → search → edit → duplicate → delete."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    request = page.context.request

    try:
        # Step 1: Fetch /new defaults via API
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )
        defaults = post_json(
            request,
            "/api/v5/artifacts/rubrics/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/system/rubrics/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-rubric-name")
        name_input.wait_for(state="visible", timeout=20000)

        rubric_name = generate_unique_name("E2E Rubric")
        name_input.fill(rubric_name)
        description_input = page.get_by_test_id("input-rubric-description")
        description_input.fill("Rubric created via E2E lifecycle test.")

        submit_button = page.get_by_test_id("btn-submit-rubric")
        submit_button.click()
        page.wait_for_url(f"{base_url}/system/rubrics", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        rubric_card = (
            page.get_by_test_id("rubric-card").filter(has_text=rubric_name).first
        )
        expect(rubric_card).to_be_visible()
        rubric_id = rubric_card.get_attribute("data-rubric-id")
        if rubric_id:
            created_ids.append(rubric_id)

        # Step 4: Search → verify filters to our item
        search_input = page.get_by_test_id("rubrics-search")
        search_input.fill(rubric_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("rubric-card").filter(has_text=rubric_name)
        ).to_have_count(1)

        # Step 5: Edit → update a field, submit, verify change
        # Step 6: Duplicate → verify copy appears
        # Step 7: Delete duplicate → confirm dialog → verify gone
        # Step 8: Delete original → confirm dialog → verify gone

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v5/artifacts/rubrics/delete",
                    {"rubricId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
