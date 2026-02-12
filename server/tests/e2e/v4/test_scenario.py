"""E2E skeleton: Scenario artifact lifecycle (/training/scenarios).

Dependencies: requires persona (created inline).
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


def test_scenario_lifecycle(page: Page, base_url: str) -> None:
    """Full CRUD lifecycle: create persona prerequisite → create scenario → detail → list → search → edit → duplicate → delete."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    prerequisite_ids: dict[str, str] = {}
    request = page.context.request

    try:
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Create prerequisite: persona (via API)
        # persona_id = create via API, track in prerequisite_ids["personas"]

        # Step 1: Fetch /new defaults via API
        defaults = post_json(
            request,
            "/api/v4/artifacts/scenarios/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/training/scenarios/new")
        page.wait_for_load_state("networkidle")
        name_input = page.get_by_test_id("input-scenario-name")
        name_input.wait_for(state="visible", timeout=20000)

        scenario_name = generate_unique_name("E2E Scenario")
        name_input.fill(scenario_name)
        description_input = page.get_by_test_id("input-scenario-description")
        description_input.fill("Scenario created via E2E lifecycle test.")

        # Select persona
        persona_picker = page.locator("[data-testid='picker-persona']")
        if persona_picker.count() > 0:
            persona_picker.click()
            persona_option = page.get_by_role("option").first
            if persona_option.count() > 0:
                persona_option.click()
            page.keyboard.press("Escape")

        submit_button = page.get_by_test_id("btn-submit-scenario")
        submit_button.click()
        page.wait_for_url(f"{base_url}/training/scenarios", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        scenario_card = (
            page.get_by_test_id("scenario-card").filter(has_text=scenario_name).first
        )
        expect(scenario_card).to_be_visible()
        scenario_id = scenario_card.get_attribute("data-scenario-id")
        if scenario_id:
            created_ids.append(scenario_id)

        # Step 4: Search → verify filters to our item
        search_input = page.get_by_test_id("scenarios-search")
        search_input.fill(scenario_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("scenario-card").filter(has_text=scenario_name)
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
                    "/api/v4/artifacts/scenarios/delete",
                    {"scenarioId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
        for entity, eid in prerequisite_ids.items():
            try:
                post_json(
                    request,
                    f"/api/v4/artifacts/{entity}/delete",
                    {f"{entity[:-1]}Id": eid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
