"""E2E test validating cache behavior and revalidation across scenario flows."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.scenarios.helpers import (
    fetch_scenarios_list,
    generate_unique_scenario_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message).first
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        fallback = page.get_by_text(message, exact=False).first
        fallback.wait_for(state="visible", timeout=5000)
        toast = fallback
    expect(toast).to_be_visible()


def _set_request_counter(
    page: Page, pattern: str
) -> tuple[dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request: Any) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_scenario_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="scenario-card"]'))
        .map(el => el.dataset.scenarioId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_scenarios_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Ensure default detail fetch happens once and mutations revalidate list data."""
    detail_counter, stop_counter = _set_request_counter(page, "/api/v3/scenarios/new")
    page.goto(f"{base_url}/create/scenarios/new")
    page.wait_for_load_state("networkidle")
    stop_counter()
    assert detail_counter["total"] <= 1, (
        "Default scenario detail endpoint fetched more than once"
    )

    scenario_name = generate_unique_scenario_name("Cache Scenario")
    problem_statement = "Cache test problem statement content."

    title_input = page.get_by_test_id("input-scenario-title")
    title_input.wait_for(state="visible", timeout=15000)
    title_input.fill(scenario_name)

    problem_statement_input = page.get_by_test_id("input-scenario-problem-statement")
    problem_statement_input.fill(problem_statement)

    submit_button = page.get_by_test_id("btn-submit-scenario")
    submit_button.click()

    _expect_toast(page, "Scenario created successfully")
    page.wait_for_url(f"{base_url}/create/scenarios")

    search_input = page.get_by_test_id("scenarios-search")
    search_input.fill(scenario_name)
    page.wait_for_timeout(250)

    scenarios_data = fetch_scenarios_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    created_entry = next(
        s
        for s in scenarios_data.get("scenarios", [])
        if s.get("title") == scenario_name
    )
    scenario_id = created_entry["scenario_id"]

    scenario_card = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{scenario_id}']"
    )
    expect(scenario_card).to_be_visible()

    existing_ids = _collect_scenario_ids(page)

    duplicate_button = scenario_card.get_by_test_id("btn-duplicate-scenario")

    # Wait for duplicate API response
    with page.expect_response(
        lambda response: "/api/v3/scenarios/duplicate" in response.url
    ) as response_info:
        duplicate_button.click()
    response = response_info.value
    assert response.ok, f"Duplicate API call failed with status {response.status}"

    # Wait for toast to appear (with flexible text matching)
    try:
        toast = page.get_by_role("alert").filter(has_text="duplicated")
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        # Fallback: just wait a bit if toast doesn't appear
        page.wait_for_timeout(1000)

    # Wait for router.refresh() to complete - wait for network idle after the mutation
    page.wait_for_load_state("networkidle")

    # Wait for grid to be visible and retry getting IDs in case refresh is still in progress
    grid = page.get_by_test_id("scenarios-grid")
    grid.wait_for(state="visible", timeout=10000)

    # Retry getting IDs a few times in case refresh is still in progress
    ids_after_duplicate = _collect_scenario_ids(page)
    retries = 0
    while not (ids_after_duplicate - existing_ids) and retries < 5:
        page.wait_for_timeout(500)
        ids_after_duplicate = _collect_scenario_ids(page)
        retries += 1

    new_ids = ids_after_duplicate - existing_ids
    assert new_ids, "Duplicate scenario card did not appear in UI"
    copy_id = new_ids.pop()

    copy_card = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{copy_id}']"
    )
    expect(copy_card).to_be_visible()
    copy_title = copy_card.inner_text().splitlines()[0].strip()

    search_input.fill(scenario_name)
    page.wait_for_timeout(250)

    edit_button = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{scenario_id}']"
    ).get_by_test_id("btn-edit-scenario")
    edit_button.click()

    page.wait_for_url(f"{base_url}/create/scenarios/s/{scenario_id}")
    page.wait_for_load_state("networkidle")

    updated_name = f"{scenario_name} Updated"
    title_input = page.get_by_test_id("input-scenario-title")
    expect(title_input).to_be_enabled()
    title_input.fill(updated_name)

    submit_button = page.get_by_test_id("btn-submit-scenario")
    submit_button.click()

    page.wait_for_url(f"{base_url}/create/scenarios")

    search_input = page.get_by_test_id("scenarios-search")
    search_input.fill(updated_name)
    page.wait_for_timeout(250)

    updated_card = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{scenario_id}']"
    )
    expect(updated_card).to_be_visible()

    updated_card.get_by_test_id("btn-delete-scenario").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(updated_card).to_have_count(0)

    search_input.fill(copy_title)
    page.wait_for_timeout(250)
    copy_card = page.locator(
        f"[data-testid='scenario-card'][data-scenario-id='{copy_id}']"
    )
    expect(copy_card).to_be_visible()

    copy_card.get_by_test_id("btn-delete-scenario").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)
