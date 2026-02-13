"""E2E skeleton: Department artifact lifecycle (/system/departments)."""

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


def test_department_lifecycle(page: Page, base_url: str) -> None:
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
            "/api/v4/artifacts/departments/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/system/departments/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-department-name")
        name_input.wait_for(state="visible", timeout=20000)

        dept_name = generate_unique_name("E2E Dept")
        name_input.fill(dept_name)
        description_input = page.get_by_test_id("input-department-description")
        description_input.fill("Department created via E2E lifecycle test.")
        submit_button = page.get_by_test_id("btn-submit-department")
        submit_button.click()

        page.wait_for_url(f"{base_url}/system/departments", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        dept_card = (
            page.get_by_test_id("department-card").filter(has_text=dept_name).first
        )
        expect(dept_card).to_be_visible()
        dept_id = dept_card.get_attribute("data-department-id")
        if dept_id:
            created_ids.append(dept_id)

        # Step 4: Search → verify filters to our item
        search_input = page.get_by_test_id("departments-search")
        search_input.fill(dept_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("department-card").filter(has_text=dept_name)
        ).to_have_count(1)

        # Step 5: Edit → update a field, submit, verify change
        dept_card.click()
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-department-name")
        name_input.wait_for(state="visible", timeout=20000)
        updated_name = generate_unique_name("E2E Dept Edited")
        name_input.fill(updated_name)
        submit_button = page.get_by_test_id("btn-submit-department")
        submit_button.click()
        page.wait_for_url(f"{base_url}/system/departments", timeout=20000)

        # Step 6: Duplicate → verify copy appears
        dept_card = page.locator(
            f"[data-testid='department-card'][data-department-id='{dept_id}']"
        )
        duplicate_button = dept_card.get_by_test_id("btn-duplicate-department")
        duplicate_button.click()
        page.wait_for_timeout(1000)

        # Step 7: Delete duplicate → confirm dialog → verify gone
        all_cards = page.get_by_test_id("department-card").filter(has_text=updated_name)
        if all_cards.count() > 1:
            dup_card = all_cards.nth(1)
            dup_id = dup_card.get_attribute("data-department-id")
            if dup_id:
                created_ids.append(dup_id)
            delete_button = dup_card.get_by_test_id("btn-delete-department")
            delete_button.click()
            confirm_button = page.get_by_test_id("btn-confirm-delete")
            confirm_button.click()
            page.wait_for_timeout(500)

        # Step 8: Delete original → confirm dialog → verify gone
        dept_card = page.locator(
            f"[data-testid='department-card'][data-department-id='{dept_id}']"
        )
        delete_button = dept_card.get_by_test_id("btn-delete-department")
        delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(dept_card).to_have_count(0)

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v4/artifacts/departments/delete",
                    {"departmentId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
