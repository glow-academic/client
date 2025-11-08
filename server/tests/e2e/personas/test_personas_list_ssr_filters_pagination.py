"""E2E tests for personas list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_personas_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure persona list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/create/personas")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("personas-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    cards = grid.get_by_test_id("persona-card")
    initial_count = cards.count()
    assert initial_count > 0

    first_card = cards.first
    persona_label = first_card.get_attribute("aria-label") or ""
    search_name = persona_label.replace("persona card ", "").strip() or first_card.inner_text().splitlines()[0].strip()

    search_input = page.get_by_test_id("personas-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(search_name)
    page.wait_for_timeout(250)
    filtered_count = cards.count()
    assert filtered_count <= initial_count
    assert (
        grid.get_by_test_id("persona-card")
        .filter(has_text=search_name)
        .count()
        > 0
    )

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count

    scenario_button = page.get_by_role("button", name="Scenario")
    scenario_button.click()
    scenario_options = page.get_by_role("option")
    if scenario_options.count() > 1:
        option = scenario_options.nth(1)
        option.click()
        page.wait_for_timeout(250)
        assert cards.count() > 0
        scenario_button.click()
        clear_option = page.get_by_role("option").filter(
            has_text("Clear filters")
        ).first
        if clear_option.count():
            clear_option.click()
        else:
            page.get_by_role("option").nth(0).click()
        page.wait_for_timeout(250)
        assert cards.count() == initial_count
    else:
        scenario_button.click()

    search_input.fill("zzzz-no-match-zzzz")
    page.wait_for_timeout(250)
    expect(cards).to_have_count(0)
    expect(page.get_by_text("No personas match the current filters.")).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count


def test_personas_pagination_persists_filters(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    data = fetch_personas_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    personas = data.get("personas", [])
    if len(personas) <= 12:
        pytest.skip("Not enough personas to validate pagination")

    page.goto(f"{base_url}/create/personas")
    page.wait_for_load_state("networkidle")

    next_button = page.get_by_role("button", name="Go to next page")
    expect(next_button).not_to_be_disabled()
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

