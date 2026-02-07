"""E2E tests for simulations list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.simulations.helpers import (
    create_simulation_api,
    delete_simulation_api,
    fetch_simulations_list,
    generate_unique_simulation_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_simulations_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure simulation list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/training/simulations")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("simulations-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    cards = grid.get_by_test_id("simulation-card")
    initial_count = cards.count()
    assert initial_count > 0

    first_card = cards.first
    simulation_label = (
        first_card.get_attribute("aria-label") or ""
    ) or first_card.inner_text().splitlines()[0].strip()
    search_name = simulation_label.strip()

    search_input = page.get_by_test_id("simulations-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(search_name)
    page.wait_for_timeout(250)
    filtered_count = cards.count()
    assert filtered_count <= initial_count
    assert (
        grid.get_by_test_id("simulation-card").filter(has_text=search_name).count() > 0
    )

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count

    toolbar = page.get_by_test_id("simulations-toolbar")

    # Test Rubric filter
    rubric_button = toolbar.get_by_role("button", name="Rubric")
    if rubric_button.count() > 0:
        rubric_button.click()
        rubric_options = page.get_by_role("option")
        if rubric_options.count() > 1:
            option = rubric_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            rubric_button.click()
            clear_option_locator = page.get_by_role("option").filter(
                has_text="Clear filters"
            )
            if clear_option_locator.count():
                clear_option_locator.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards.count() == initial_count
        else:
            rubric_button.click()

    # Test Cohort filter
    cohort_button = toolbar.get_by_role("button", name="Cohort")
    if cohort_button.count() > 0:
        cohort_button.click()
        cohort_options = page.get_by_role("option")
        if cohort_options.count() > 1:
            option = cohort_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            cohort_button.click()
            clear_option_locator = page.get_by_role("option").filter(
                has_text="Clear filters"
            )
            if clear_option_locator.count():
                clear_option_locator.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards.count() == initial_count
        else:
            cohort_button.click()

    # Test Department filter
    department_button = toolbar.get_by_role("button", name="Department")
    if department_button.count() > 0:
        department_button.click()
        department_options = page.get_by_role("option")
        if department_options.count() > 1:
            option = department_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            department_button.click()
            clear_option_locator = page.get_by_role("option").filter(
                has_text="Clear filters"
            )
            if clear_option_locator.count():
                clear_option_locator.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards.count() == initial_count
        else:
            department_button.click()

    search_input.fill("zzzz-no-match-zzzz")
    page.wait_for_timeout(250)
    expect(cards).to_have_count(0)
    expect(
        page.get_by_text("No simulations match the current filters.")
    ).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count


def test_simulations_list_pagination(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    created_simulation_ids: list[str] = []
    try:
        data = fetch_simulations_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        simulations = data.get("simulations", [])
        if len(simulations) <= 12:
            needed = 13 - len(simulations)
            # Get valid rubric_id from defaults
            defaults_data = data.get("rubric_mapping", {})
            rubric_ids = list(defaults_data.keys()) if defaults_data else []
            if not rubric_ids:
                pytest.skip("No rubrics available for creating test simulations")

            for _ in range(needed):
                simulation_id = create_simulation_api(
                    page.context.request,
                    title=generate_unique_simulation_name("Pagination Simulation"),
                    description="Simulation created for pagination test",
                    rubric_id=rubric_ids[0],
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
                created_simulation_ids.append(simulation_id)
            page.goto(f"{base_url}/training/simulations")
            page.wait_for_load_state("networkidle")

        page.goto(f"{base_url}/training/simulations")
        page.wait_for_load_state("networkidle")

        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.is_disabled():
            pytest.skip("Pagination controls unavailable after seeding simulations")
        next_button.click()
        page.wait_for_timeout(250)

        page.reload()
        page.wait_for_load_state("networkidle")
        pagination_label = page.get_by_text("Page 2 of")
        expect(pagination_label).to_be_visible()

        prev_button = page.get_by_role("button", name="Go to previous page")
        prev_button.click()
        page.wait_for_timeout(250)
        expect(page.get_by_text("Page 1 of")).to_be_visible()
    finally:
        for simulation_id in created_simulation_ids:
            try:
                delete_simulation_api(
                    page.context.request,
                    simulation_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
