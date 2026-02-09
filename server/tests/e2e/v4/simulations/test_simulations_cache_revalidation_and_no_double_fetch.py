"""E2E test validating cache behavior and revalidation across simulation flows."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.simulations.helpers import (
    fetch_simulations_list,
    generate_unique_simulation_name,
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


def _collect_simulation_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="simulation-card"]'))
        .map(el => el.dataset.simulationId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_simulations_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Ensure default detail fetch happens once and mutations revalidate list data."""
    detail_counter, stop_counter = _set_request_counter(
        page, "/api/v4/artifacts/simulations/new"
    )
    page.goto(f"{base_url}/training/simulations/new")
    page.wait_for_load_state("networkidle")
    stop_counter()
    assert detail_counter["total"] <= 1, (
        "Default simulation detail endpoint fetched more than once"
    )

    # Get defaults for creating simulation
    from server.tests.e2e.simulations.helpers import (
        fetch_simulation_new,
    )

    defaults = fetch_simulation_new(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        effective_profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    valid_rubric_ids = defaults.get("valid_rubric_ids", [])
    if not valid_rubric_ids:
        pytest.skip("No rubrics available for creating test simulation")

    simulation_name = generate_unique_simulation_name("Cache Simulation")

    name_input = page.get_by_test_id("input-simulation-title")
    name_input.wait_for(state="visible", timeout=20000)
    name_input.fill(simulation_name)

    description_input = page.get_by_test_id("input-simulation-description")
    description_input.fill("Simulation created for cache revalidation test.")

    rubric_picker = page.locator("[data-testid='picker-rubric']")
    rubric_picker.click()
    rubric_option = page.get_by_role("option").first
    expect(rubric_option).to_be_visible()
    rubric_option.click()

    submit_button = page.get_by_test_id("btn-submit-simulation")
    submit_button.click()

    _expect_toast(page, "Simulation created successfully!")
    page.wait_for_url(f"{base_url}/training/simulations")

    search_input = page.get_by_test_id("simulations-search")
    search_input.fill(simulation_name)
    page.wait_for_timeout(250)

    simulations_data = fetch_simulations_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
        bypass_cache=True,
    )
    created_entry = next(
        s
        for s in simulations_data.get("simulations", [])
        if s.get("name") == simulation_name
    )
    simulation_id = created_entry["simulation_id"]

    simulation_card = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
    )
    expect(simulation_card).to_be_visible()

    existing_ids = _collect_simulation_ids(page)

    duplicate_button = simulation_card.get_by_test_id("btn-duplicate-simulation")
    duplicate_button.click()
    page.wait_for_timeout(500)

    ids_after_duplicate = _collect_simulation_ids(page)
    new_ids = ids_after_duplicate - existing_ids
    assert new_ids, "Duplicate simulation card did not appear in UI"
    copy_id = new_ids.pop()

    copy_card = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{copy_id}']"
    )
    expect(copy_card).to_be_visible()
    copy_name = copy_card.inner_text().splitlines()[0].strip()

    search_input.fill(simulation_name)
    page.wait_for_timeout(250)

    edit_button = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
    ).get_by_test_id("btn-edit-simulation")
    edit_button.click()

    page.wait_for_url(f"{base_url}/training/simulations/s/{simulation_id}")
    page.wait_for_load_state("networkidle")

    # Wait for form to be fully loaded
    container = page.locator("[data-page='simulation-edit']").first
    container.wait_for(state="visible", timeout=15000)

    updated_name = f"{simulation_name} Updated"
    name_input = page.get_by_test_id("input-simulation-title")
    name_input.wait_for(state="visible", timeout=10000)
    expect(name_input).to_be_enabled()
    name_input.fill(updated_name)

    # Verify rubric is selected (required field) - it should be from existing simulation
    rubric_picker = page.locator("[data-testid='picker-rubric']")
    rubric_picker.wait_for(state="visible", timeout=10000)
    # The rubric should already be selected from the existing simulation

    submit_button = page.get_by_test_id("btn-submit-simulation")
    expect(submit_button).to_be_enabled()
    submit_button.click()

    # Wait for toast first, then navigation (like personas test)
    _expect_toast(page, "Simulation updated successfully!")
    page.wait_for_url(f"{base_url}/training/simulations")
    page.wait_for_load_state("networkidle")

    search_input = page.get_by_test_id("simulations-search")
    search_input.fill(updated_name)
    page.wait_for_timeout(250)

    updated_card = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
    )
    expect(updated_card).to_be_visible()

    updated_card.get_by_test_id("btn-delete-simulation").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(updated_card).to_have_count(0)

    search_input.fill(copy_name)
    page.wait_for_timeout(250)
    copy_card = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{copy_id}']"
    )
    expect(copy_card).to_be_visible()

    copy_card.get_by_test_id("btn-delete-simulation").click()
    confirm_button = page.get_by_test_id("btn-confirm-delete")
    expect(confirm_button).to_be_enabled()
    confirm_button.click()
    page.wait_for_timeout(500)
    expect(copy_card).to_have_count(0)
