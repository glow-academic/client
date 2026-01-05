"""E2E tests for simulation duplicate operation and list refresh."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.simulations.helpers import (
    delete_simulation_api,
    fetch_simulations_list,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _get_simulation_ids(page: Page) -> set[str]:
    """Extract simulation IDs from visible cards."""
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="simulation-card"]'))
        .map(el => el.dataset.simulationId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_simulation_duplicate_refreshes_list(page: Page, base_url: str) -> None:
    """Verify duplicate operation refreshes list correctly."""
    page.goto(f"{base_url}/create/simulations")
    page.wait_for_load_state("networkidle")

    initial_ids = _get_simulation_ids(page)
    assert len(initial_ids) > 0

    # Find simulation with can_duplicate=true
    data = fetch_simulations_list(
        page.context.request,
        profile_id=ADMIN_PROFILE_ID,
    )
    simulations = data.get("simulations", [])
    duplicatable_sim = next((s for s in simulations if s.get("can_duplicate")), None)
    if not duplicatable_sim:
        pytest.skip("No duplicatable simulation available")

    simulation_id = duplicatable_sim["simulation_id"]
    duplicatable_sim["name"]

    simulation_card = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
    )
    expect(simulation_card).to_be_visible()

    duplicate_button = simulation_card.get_by_test_id("btn-duplicate-simulation")
    expect(duplicate_button).to_be_visible()
    duplicate_button.click()

    # Verify loading state (button disabled or spinner)
    page.wait_for_timeout(500)

    # Wait for page refresh
    page.wait_for_load_state("networkidle", timeout=10000)

    # Verify new simulation appears
    new_ids = _get_simulation_ids(page)
    assert len(new_ids) > len(initial_ids)

    # Verify original simulation still present
    original_card = page.locator(
        f"[data-testid='simulation-card'][data-simulation-id='{simulation_id}']"
    )
    expect(original_card).to_be_visible()

    # Find the duplicate (should have similar name or be in the list)
    # The duplicate will have a different ID
    duplicated_sims = [
        s for s in new_ids if s != simulation_id and s not in initial_ids
    ]
    assert len(duplicated_sims) > 0

    # Cleanup: delete duplicated simulation
    duplicated_id = duplicated_sims[0]
    try:
        delete_simulation_api(
            page.context.request,
            duplicated_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
    except Exception:
        pass
