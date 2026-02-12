"""E2E skeleton: Eval artifact lifecycle (/system/evals)."""

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


def test_eval_lifecycle(page: Page, base_url: str) -> None:
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
            "/api/v4/artifacts/evals/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/system/evals/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-eval-name")
        name_input.wait_for(state="visible", timeout=20000)

        eval_name = generate_unique_name("E2E Eval")
        name_input.fill(eval_name)
        description_input = page.get_by_test_id("input-eval-description")
        description_input.fill("Eval created via E2E lifecycle test.")

        submit_button = page.get_by_test_id("btn-submit-eval")
        submit_button.click()
        page.wait_for_url(f"{base_url}/system/evals", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        eval_card = page.get_by_test_id("eval-card").filter(has_text=eval_name).first
        expect(eval_card).to_be_visible()
        eval_id = eval_card.get_attribute("data-eval-id")
        if eval_id:
            created_ids.append(eval_id)

        # Step 4: Search → verify filters to our item
        # Step 5: Edit → update a field, submit, verify change
        # Step 6: Duplicate → verify copy appears
        # Step 7: Delete duplicate → confirm dialog → verify gone
        # Step 8: Delete original → confirm dialog → verify gone

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v4/artifacts/evals/delete",
                    {"evalId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
