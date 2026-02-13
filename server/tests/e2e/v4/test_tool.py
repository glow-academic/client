"""E2E skeleton: Tool artifact lifecycle (/intelligence/tools)."""

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


def test_tool_lifecycle(page: Page, base_url: str) -> None:
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
            "/api/v4/artifacts/tools/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/intelligence/tools/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-tool-name")
        name_input.wait_for(state="visible", timeout=20000)

        tool_name = generate_unique_name("E2E Tool")
        name_input.fill(tool_name)
        description_input = page.get_by_test_id("input-tool-description")
        description_input.fill("Tool created via E2E lifecycle test.")

        submit_button = page.get_by_test_id("btn-submit-tool")
        submit_button.click()
        page.wait_for_url(f"{base_url}/intelligence/tools", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        tool_card = page.get_by_test_id("tool-card").filter(has_text=tool_name).first
        expect(tool_card).to_be_visible()
        tool_id = tool_card.get_attribute("data-tool-id")
        if tool_id:
            created_ids.append(tool_id)

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
                    "/api/v4/artifacts/tools/delete",
                    {"toolId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
