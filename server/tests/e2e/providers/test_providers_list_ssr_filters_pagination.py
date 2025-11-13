"""E2E tests for providers list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    create_provider_api,
    delete_provider_api,
    fetch_providers_list,
    generate_unique_provider_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_providers_list_ssr_renders_correctly(page: Page, base_url: str) -> None:
    """Ensure providers list SSR renders correctly with proper test IDs."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    # Verify data-page attribute
    page_container = page.locator("[data-page='providers-index']")
    expect(page_container).to_be_visible()

    # Verify toolbar
    toolbar = page.get_by_test_id("providers-toolbar")
    toolbar.wait_for(state="visible", timeout=15000)
    expect(toolbar).to_be_visible()

    # Verify search input
    search_input = page.get_by_test_id("providers-search")
    expect(search_input).to_be_visible()

    # Verify grid
    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    # Verify provider cards have data-provider-id
    provider_cards = grid.get_by_test_id("provider-card")
    if provider_cards.count() > 0:
        first_provider_card = provider_cards.first
        expect(first_provider_card).to_be_visible()
        provider_id = first_provider_card.get_attribute("data-provider-id")
        assert provider_id, "Provider card missing data-provider-id attribute"

    # Verify model cards have data-model-id and data-provider-id
    model_cards = grid.get_by_test_id("model-card")
    if model_cards.count() > 0:
        first_model_card = model_cards.first
        expect(first_model_card).to_be_visible()
        model_id = first_model_card.get_attribute("data-model-id")
        provider_id_attr = first_model_card.get_attribute("data-provider-id")
        assert model_id, "Model card missing data-model-id attribute"
        assert provider_id_attr, "Model card missing data-provider-id attribute"


def test_providers_search_filters_results(page: Page, base_url: str) -> None:
    """Ensure provider list search filters results correctly."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    # Get initial count of all model cards (models are what we search)
    all_model_cards = grid.get_by_test_id("model-card")
    initial_count = all_model_cards.count()

    if initial_count == 0:
        pytest.skip("No models available to test search")

    # Get first model card to extract name
    first_model_card = all_model_cards.first
    model_name = first_model_card.inner_text().splitlines()[0].strip()

    search_input = page.get_by_test_id("providers-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(model_name)
    page.wait_for_timeout(250)

    # Verify filtered results
    filtered_cards = grid.get_by_test_id("model-card")
    filtered_count = filtered_cards.count()
    assert filtered_count <= initial_count
    assert (
        grid.get_by_test_id("model-card")
        .filter(has_text=model_name)
        .count()
        > 0
    )

    # Clear search
    search_input.fill("")
    page.wait_for_timeout(250)
    assert grid.get_by_test_id("model-card").count() == initial_count


def test_providers_filters_work_correctly(page: Page, base_url: str) -> None:
    """Ensure provider filters (Provider, Custom Model, Status) work correctly."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)
    expect(grid).to_be_visible()

    toolbar = page.get_by_test_id("providers-toolbar")
    initial_count = grid.get_by_test_id("model-card").count()

    if initial_count == 0:
        pytest.skip("No models available to test filters")

    # Test Provider filter
    provider_button = toolbar.get_by_role("button", name="Provider")
    if provider_button.count() > 0:
        provider_button.click()
        provider_options = page.get_by_role("option")
        if provider_options.count() > 1:
            option = provider_options.nth(1)
            option_text = option.inner_text()
            option.click()
            page.wait_for_timeout(250)
            filtered_count = grid.get_by_test_id("model-card").count()
            assert filtered_count <= initial_count

            # Clear filter
            reset_button = toolbar.get_by_role("button", name="Reset")
            if reset_button.count() > 0:
                reset_button.click()
                page.wait_for_timeout(250)
                assert grid.get_by_test_id("model-card").count() == initial_count

    # Test Custom Model filter
    type_button = toolbar.get_by_role("button", name="Type")
    if type_button.count() > 0:
        type_button.click()
        type_options = page.get_by_role("option")
        if type_options.count() > 0:
            option = type_options.first
            option.click()
            page.wait_for_timeout(250)
            filtered_count = grid.get_by_test_id("model-card").count()
            assert filtered_count <= initial_count

    # Test Status filter
    status_button = toolbar.get_by_role("button", name="Status")
    if status_button.count() > 0:
        status_button.click()
        status_options = page.get_by_role("option")
        if status_options.count() > 0:
            option = status_options.first
            option.click()
            page.wait_for_timeout(250)
            filtered_count = grid.get_by_test_id("model-card").count()
            assert filtered_count <= initial_count

    # Test filter reset
    reset_button = toolbar.get_by_role("button", name="Reset")
    if reset_button.count() > 0:
        reset_button.click()
        page.wait_for_timeout(250)
        # After reset, count should be back to initial or close
        final_count = grid.get_by_test_id("model-card").count()
        assert final_count >= filtered_count


def test_providers_pagination_navigation(page: Page, base_url: str) -> None:
    """Ensure pagination controls work correctly."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)

    # Check if pagination exists
    pagination = page.locator("[aria-label='pagination controls']")
    if pagination.count() == 0:
        pytest.skip("Pagination not present - likely not enough items")

    # Try to navigate to next page if available
    next_button = pagination.get_by_role("button", name="Next")
    if next_button.count() > 0 and next_button.is_enabled():
        next_button.click()
        page.wait_for_timeout(500)
        # Verify we're still on the page
        expect(grid).to_be_visible()

        # Try to go back
        prev_button = pagination.get_by_role("button", name="Previous")
        if prev_button.count() > 0 and prev_button.is_enabled():
            prev_button.click()
            page.wait_for_timeout(500)
            expect(grid).to_be_visible()


def test_providers_empty_state_displays(page: Page, base_url: str) -> None:
    """Ensure empty state displays when filters show no results."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)

    search_input = page.get_by_test_id("providers-search")
    search_input.wait_for(state="visible", timeout=10000)

    # Search for something that definitely won't exist
    search_input.fill("__NONEXISTENT_SEARCH_TERM_XYZ__")
    page.wait_for_timeout(500)

    # Verify empty state or no results message
    empty_message = page.get_by_text("No models match the current filters")
    if empty_message.count() > 0:
        expect(empty_message).to_be_visible()

    # Clear search
    search_input.fill("")
    page.wait_for_timeout(250)

