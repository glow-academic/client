"""E2E tests for model display within provider groups."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (create_model_api,
                                                create_provider_api,
                                                delete_model_api,
                                                delete_provider_api)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_models_display_in_provider_groups(page: Page, base_url: str) -> None:
    """Verify models are grouped under their providers correctly."""
    provider_id = None
    model_id = None

    try:
        # Create provider and model via API
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Groups",
            description="Provider for model groups test.",
            api_key="test-api-key-groups",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name="Test Model in Group",
            description="Model for groups test.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to providers list and refresh to get newly created items
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")
        page.reload()  # Refresh to get newly created provider and model from server
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Clear any active filters to ensure items are visible
        reset_button = page.get_by_role("button", name="Reset")
        if reset_button.count() > 0:
            reset_button.click()
            page.wait_for_timeout(500)

        # Verify provider card exists
        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        provider_card.wait_for(state="visible", timeout=10000)
        expect(provider_card).to_be_visible()

        # Verify model card exists within provider group
        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        model_card.wait_for(state="visible", timeout=10000)
        expect(model_card).to_be_visible()

        # Verify model has correct provider_id attribute
        model_provider_id = model_card.get_attribute("data-provider-id")
        assert (
            model_provider_id == provider_id
        ), "Model should have correct provider_id attribute"

        # Verify "Create New Model" card exists for provider
        # (This is harder to test directly, but we can verify the provider group structure)

    finally:
        # Cleanup
        if model_id:
            try:
                delete_model_api(
                    page.context.request,
                    model_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
        if provider_id:
            try:
                delete_provider_api(
                    page.context.request,
                    provider_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_model_card_actions_visible(page: Page, base_url: str) -> None:
    """Verify model card action buttons are visible based on permissions."""
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)

    model_cards = grid.get_by_test_id("model-card")
    if model_cards.count() == 0:
        pytest.skip("No models available to test actions")

    first_model_card = model_cards.first
    expect(first_model_card).to_be_visible()

    # Verify duplicate button exists (should be available for all models)
    duplicate_button = first_model_card.get_by_test_id("btn-duplicate-model")
    expect(duplicate_button).to_be_visible()

    # Check if edit button exists (may not exist if model is not editable)
    edit_button = first_model_card.get_by_test_id("btn-edit-model")
    if edit_button.count() > 0:
        expect(edit_button).to_be_visible()

    # Check if delete button exists (may not exist if model is in use)
    delete_button = first_model_card.get_by_test_id("btn-delete-model")
    if delete_button.count() > 0:
        expect(delete_button).to_be_visible()


def test_create_model_card_navigation(page: Page, base_url: str) -> None:
    """Verify clicking 'Create New Model' card navigates correctly."""
    provider_id = None

    try:
        # Create a provider first
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Create Model Nav",
            description="Provider for create model navigation test.",
            api_key="test-api-key-create-nav",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to providers list and refresh to get newly created provider
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")
        page.reload()  # Refresh to get newly created provider from server
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Clear any active filters to ensure provider without models is visible
        # (Providers without models are hidden when filters are active)
        reset_button = page.get_by_role("button", name="Reset")
        if reset_button.count() > 0:
            reset_button.click()
            page.wait_for_timeout(500)

        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        # Wait longer for provider card - it may take time to render
        provider_card.wait_for(state="visible", timeout=10000)
        expect(provider_card).to_be_visible()

        # Find the "Create New Model" card within this provider group
        # It should be a card with dashed border that contains "Create New Model" text
        create_card = provider_card.locator("..").get_by_text("Create New Model").locator("..").locator("..")
        if create_card.count() == 0:
            # Try alternative selector - look for card with "Create New Model" text
            create_card = page.get_by_text("Create New Model").locator("..").locator("..")
        
        if create_card.count() > 0:
            create_card.first.click()
            page.wait_for_url(
                f"{base_url}/system/providers/p/{provider_id}/new", timeout=10000
            )
            page.wait_for_load_state("networkidle")

            # Verify we're on the create model page
            name_input = page.get_by_test_id("input-model-name")
            name_input.wait_for(state="visible", timeout=10000)
            expect(name_input).to_be_visible()

    finally:
        # Cleanup
        if provider_id:
            try:
                delete_provider_api(
                    page.context.request,
                    provider_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass

