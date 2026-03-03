"""E2E skeleton: Simulation artifact lifecycle (/training/simulations).

Dependencies: requires rubric + scenario (created inline).
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


def test_simulation_lifecycle(page: Page, base_url: str) -> None:
    """Full CRUD lifecycle: create prerequisites → create simulation → detail → list → search → edit → duplicate → delete."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    prerequisite_ids: dict[str, str] = {}
    request = page.context.request

    try:
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Create prerequisite: rubric (via API)
        # Create prerequisite: scenario (via API, needs persona)
        # Track in prerequisite_ids

        # Step 1: Fetch /new defaults via API
        defaults = post_json(
            request,
            "/api/v5/artifacts/simulations/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via UI — navigate to /new, fill form, submit
        page.goto(f"{base_url}/training/simulations/new")
        page.wait_for_load_state("networkidle")

        page_container = page.locator("[data-page='simulation-new']").first
        expect(page_container).to_be_visible()

        name_input = page.get_by_test_id("input-simulation-title")
        name_input.wait_for(state="visible", timeout=20000)

        sim_name = generate_unique_name("E2E Simulation")
        name_input.fill(sim_name)
        description_input = page.get_by_test_id("input-simulation-description")
        description_input.fill("Simulation created via E2E lifecycle test.")

        # Select rubric (required)
        rubric_picker = page.locator("[data-testid='picker-rubric']")
        rubric_picker.wait_for(state="visible", timeout=15000)
        rubric_picker.click()
        rubric_option = page.get_by_role("option").first
        if rubric_option.count() > 0:
            rubric_option.click()
        else:
            pytest.skip("No rubrics available for creating simulation")

        # Set time limit
        time_limit_input = page.get_by_test_id("input-simulation-time-limit")
        time_limit_input.wait_for(state="visible", timeout=10000)
        time_limit_input.fill("30")

        # Select scenarios
        scenario_picker = page.locator("[data-testid='picker-scenario']")
        if scenario_picker.count() > 0:
            scenario_picker.click()
            scenario_option = page.get_by_role("option").first
            if scenario_option.count():
                scenario_option.click()
            page.keyboard.press("Escape")

        submit_button = page.get_by_test_id("btn-submit-simulation")
        submit_button.click()
        page.wait_for_url(f"{base_url}/training/simulations", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Step 3: Verify card visible on list page
        sim_card = (
            page.get_by_test_id("simulation-card").filter(has_text=sim_name).first
        )
        expect(sim_card).to_be_visible()
        sim_id = sim_card.get_attribute("data-simulation-id")
        if sim_id:
            created_ids.append(sim_id)

        # Step 4: Search → verify filters to our item
        search_input = page.get_by_test_id("simulations-search")
        search_input.fill(sim_name)
        page.wait_for_timeout(250)
        expect(
            page.get_by_test_id("simulation-card").filter(has_text=sim_name)
        ).to_have_count(1)

        # Step 5: Edit → update a field, submit, verify change
        # Step 6: Duplicate → verify copy appears
        # Step 7: Delete duplicate → confirm dialog → verify gone
        # Step 8: Delete original → confirm dialog → verify gone
        sim_card = page.locator(
            f"[data-testid='simulation-card'][data-simulation-id='{sim_id}']"
        )
        delete_button = sim_card.get_by_test_id("btn-delete-simulation")
        delete_button.click()
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(sim_card).to_have_count(0)

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v5/artifacts/simulations/delete",
                    {"simulationId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
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
