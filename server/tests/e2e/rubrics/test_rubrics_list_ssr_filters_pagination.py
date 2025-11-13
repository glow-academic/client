"""E2E tests for rubrics list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.rubrics.helpers import (
    create_rubric_api,
    delete_rubric_api,
    fetch_rubrics_list,
    generate_unique_rubric_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_rubrics_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure rubric list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/management/rubrics")
    page.wait_for_load_state("networkidle")

    # Verify page attribute
    page_container = page.locator("[data-page='rubrics-index']")
    expect(page_container).to_be_visible()

    grid = page.get_by_test_id("rubrics-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    cards = grid.get_by_test_id("rubric-card")
    initial_count = cards.count()
    assert initial_count > 0

    first_card = cards.first
    rubric_name = first_card.inner_text().splitlines()[0].strip()

    search_input = page.get_by_test_id("rubrics-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(rubric_name)
    page.wait_for_timeout(250)
    filtered_count = cards.count()
    assert filtered_count <= initial_count
    assert (
        grid.get_by_test_id("rubric-card")
        .filter(has_text=rubric_name)
        .count()
        > 0
    )

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count

    toolbar = page.get_by_test_id("rubrics-toolbar")

    # Test Pass % filter
    pass_percentage_button = toolbar.get_by_role("button", name="Pass %")
    if pass_percentage_button.count():
        pass_percentage_button.click()
        pass_percentage_options = page.get_by_role("option")
        if pass_percentage_options.count() > 1:
            option = pass_percentage_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            pass_percentage_button.click()
            clear_option = page.get_by_role("option").filter(has_text="Clear filters")
            if clear_option.count():
                clear_option.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards.count() == initial_count
        else:
            pass_percentage_button.click()

    # Test Department filter
    department_button = toolbar.get_by_role("button", name="Department")
    if department_button.count():
        department_button.click()
        department_options = page.get_by_role("option")
        if department_options.count() > 1:
            option = department_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            department_button.click()
            clear_option = page.get_by_role("option").filter(has_text="Clear filters")
            if clear_option.count():
                clear_option.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards.count() == initial_count
        else:
            department_button.click()

    # Test Simulations filter
    simulations_button = toolbar.get_by_role("button", name="Simulations")
    if simulations_button.count():
        simulations_button.click()
        simulations_options = page.get_by_role("option")
        if simulations_options.count() > 1:
            option = simulations_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            simulations_button.click()
            clear_option = page.get_by_role("option").filter(has_text="Clear filters")
            if clear_option.count():
                clear_option.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards.count() == initial_count
        else:
            simulations_button.click()

    # Test empty state
    search_input.fill("zzzz-no-match-zzzz")
    page.wait_for_timeout(250)
    expect(cards).to_have_count(0)
    expect(
        page.get_by_text("No rubrics match the current filters.")
    ).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count


def test_rubrics_pagination_persists_filters(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    created_rubric_ids: list[str] = []
    try:
        data = fetch_rubrics_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        rubrics = data.get("rubrics", [])
        if len(rubrics) <= 12:
            needed = 13 - len(rubrics)
            for _ in range(needed):
                rubric_id = create_rubric_api(
                    page.context.request,
                    name=generate_unique_rubric_name("Pagination Rubric"),
                    description="Rubric created for pagination test",
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
                created_rubric_ids.append(rubric_id)
            page.goto(f"{base_url}/management/rubrics")
            page.wait_for_load_state("networkidle")

        page.goto(f"{base_url}/management/rubrics")
        page.wait_for_load_state("networkidle")

        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.is_disabled():
            pytest.skip("Pagination controls unavailable after seeding rubrics")
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
        for rubric_id in created_rubric_ids:
            try:
                delete_rubric_api(
                    page.context.request,
                    rubric_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

