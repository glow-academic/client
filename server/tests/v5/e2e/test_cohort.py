"""E2E skeleton: Cohort artifact lifecycle (/training/cohorts).

Dependencies: requires rubric + scenario + simulation (created inline).
"""

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


def test_cohort_lifecycle(page: Page, base_url: str) -> None:
    """Full CRUD lifecycle: create prerequisites → create cohort → detail → list → search → edit → duplicate → delete."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    prerequisite_ids: dict[str, str] = {}
    request = page.context.request

    try:
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Create prerequisite: rubric
        # Create prerequisite: scenario (needs persona)
        # Create prerequisite: simulation (needs rubric + scenario)
        # These would be created via API and tracked in prerequisite_ids

        # Step 1: Fetch /new defaults via API
        defaults = post_json(
            request,
            "/api/v5/artifacts/cohorts/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/training/cohorts/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-cohort-name")
        name_input.wait_for(state="visible", timeout=20000)

        cohort_name = generate_unique_name("E2E Cohort")
        name_input.fill(cohort_name)
        description_input = page.get_by_test_id("input-cohort-description")
        description_input.fill("Cohort created via E2E lifecycle test.")

        # Select simulation
        simulation_picker = page.locator("[data-testid='picker-simulation']")
        if simulation_picker.count() > 0:
            simulation_picker.click()
            simulation_option = page.get_by_role("option").first
            if simulation_option.count() > 0:
                simulation_option.click()
            page.keyboard.press("Escape")

        submit_button = page.get_by_test_id("btn-submit-cohort")
        submit_button.click()

        page.wait_for_url(f"{base_url}/training/cohorts", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        cohort_card = (
            page.get_by_test_id("cohort-card").filter(has_text=cohort_name).first
        )
        expect(cohort_card).to_be_visible()
        cohort_id = cohort_card.get_attribute("data-cohort-id")
        if cohort_id:
            created_ids.append(cohort_id)

        # Step 4: Search → verify filters to our item
        search_input = page.get_by_test_id("cohorts-search")
        search_input.fill(cohort_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("cohort-card").filter(has_text=cohort_name)
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
                    "/api/v5/artifacts/cohorts/delete",
                    {"cohortId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
        # Clean up prerequisites
        for entity, eid in prerequisite_ids.items():
            try:
                post_json(
                    request,
                    f"/api/v5/artifacts/{entity}/delete",
                    {f"{entity[:-1]}Id": eid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
