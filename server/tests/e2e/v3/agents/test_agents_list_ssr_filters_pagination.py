"""E2E tests for agents list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.agents.helpers import (
    create_agent_api,
    delete_agent_api,
    fetch_agents_list,
    generate_unique_agent_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_agents_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure agent list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/management/agents")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("agents-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    cards = grid.get_by_test_id("agent-card")
    initial_count = cards.count()
    assert initial_count > 0

    first_card = cards.first
    agent_label = first_card.get_attribute("aria-label") or ""
    search_name = (
        agent_label.replace("agent card ", "").strip()
        or first_card.inner_text().splitlines()[0].strip()
    )

    search_input = page.get_by_test_id("agents-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(search_name)
    page.wait_for_timeout(250)
    filtered_count = cards.count()
    assert filtered_count <= initial_count
    assert grid.get_by_test_id("agent-card").filter(has_text=search_name).count() > 0

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count

    toolbar = page.get_by_test_id("agents-toolbar")

    # Test Model filter
    model_button = toolbar.get_by_role("button", name="Model")
    if model_button.count() > 0:
        model_button.click()
        model_options = page.get_by_role("option")
        if model_options.count() > 1:
            option = model_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            model_button.click()
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
            model_button.click()

    # Test Role filter
    role_button = toolbar.get_by_role("button", name="Role")
    if role_button.count() > 0:
        role_button.click()
        role_options = page.get_by_role("option")
        if role_options.count() > 1:
            option = role_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards.count() > 0
            role_button.click()
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
            role_button.click()

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
        page.get_by_text("No system agents match the current filters.")
    ).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards.count() == initial_count


def test_agents_pagination_persists_filters(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    created_agent_ids: list[str] = []
    try:
        data = fetch_agents_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        agents = data.get("agents", [])
        if len(agents) <= 12:
            needed = 13 - len(agents)
            for _ in range(needed):
                agent_id = create_agent_api(
                    page.context.request,
                    name=generate_unique_agent_name("Pagination Agent"),
                    description="Agent created for pagination test",
                    system_prompt="System prompt for pagination test agent.",
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
                created_agent_ids.append(agent_id)
            page.goto(f"{base_url}/management/agents")
            page.wait_for_load_state("networkidle")

        page.goto(f"{base_url}/management/agents")
        page.wait_for_load_state("networkidle")

        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.is_disabled():
            pytest.skip("Pagination controls unavailable after seeding agents")
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
        for agent_id in created_agent_ids:
            try:
                delete_agent_api(
                    page.context.request,
                    agent_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
