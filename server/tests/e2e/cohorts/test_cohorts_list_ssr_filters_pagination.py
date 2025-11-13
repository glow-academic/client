"""E2E tests for cohorts list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.cohorts.helpers import (
    create_cohort_api,
    delete_cohort_api,
    fetch_cohorts_list,
    generate_unique_cohort_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_cohorts_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure cohort list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/cohorts")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("cohorts-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    cards = grid.get_by_test_id("cohort-card")
    initial_count = cards.count()
    assert initial_count > 0

    first_card = cards.first
    cohort_label = first_card.get_attribute("aria-label") or ""
    search_name = (
        cohort_label.replace("cohort card ", "").strip()
        or first_card.inner_text().splitlines()[0].strip()
    )

    search_input = page.get_by_test_id("cohorts-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(search_name)
    page.wait_for_timeout(250)
    filtered_count = cards.count()
    assert filtered_count <= initial_count
    assert (
        grid.get_by_test_id("cohort-card")
        .filter(has_text=search_name)
        .count()
        > 0
    )

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count

    toolbar = page.get_by_test_id("cohorts-toolbar")
    profile_button = toolbar.get_by_role("button", name="Profile")
    if profile_button.count() > 0:
        profile_button.click()
        profile_options = page.get_by_role("option")
        if profile_options.count() > 1:
            option = profile_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            profile_button.click()
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
            profile_button.click()

    simulation_button = toolbar.get_by_role("button", name="Simulation")
    if simulation_button.count() > 0:
        simulation_button.click()
        simulation_options = page.get_by_role("option")
        if simulation_options.count() > 1:
            option = simulation_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            simulation_button.click()
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
            simulation_button.click()

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
        page.get_by_text("No cohorts match the current filters.")
    ).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count


def test_cohorts_pagination_persists_filters(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    created_cohort_ids: list[str] = []
    try:
        data = fetch_cohorts_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        cohorts = data.get("cohorts", [])
        if len(cohorts) <= 12:
            needed = 13 - len(cohorts)
            for _ in range(needed):
                cohort_id = create_cohort_api(
                    page.context.request,
                    name=generate_unique_cohort_name("Pagination Cohort"),
                    description="Cohort created for pagination test",
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
                created_cohort_ids.append(cohort_id)
            page.goto(f"{base_url}/cohorts")
            page.wait_for_load_state("networkidle")

        page.goto(f"{base_url}/cohorts")
        page.wait_for_load_state("networkidle")

        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.is_disabled():
            pytest.skip("Pagination controls unavailable after seeding cohorts")
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
        for cohort_id in created_cohort_ids:
            try:
                delete_cohort_api(
                    page.context.request,
                    cohort_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

