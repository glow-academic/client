"""E2E tests covering provider delete confirmation and cancellation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    delete_provider_api,
    generate_unique_provider_name,
)
from server.tests.e2e.providers.ui_flows import create_provider_via_ui

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message)
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        toast = page.get_by_text(message, exact=False)
        toast.wait_for(state="visible", timeout=5000)
    expect(toast).to_be_visible()


def test_provider_delete_cancel_preserves_provider(page: Page, base_url: str) -> None:
    """Ensure delete dialog cancel preserves provider."""
    provider_name, provider_id = create_provider_via_ui(
        page,
        base_url,
        name=generate_unique_provider_name("Deletable Provider"),
        description="Provider targeted for delete E2E test.",
        api_key="test-api-key-delete",
    )

    provider_card = page.locator(
        f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
    )
    expect(provider_card).to_be_visible()

    delete_button = provider_card.get_by_test_id("btn-delete-provider")
    delete_button.click()

    dialog = page.get_by_test_id("dialog-delete-provider")
    dialog.wait_for(state="visible", timeout=10000)
    expect(dialog).to_be_visible()

    # Find cancel button (may be AlertDialogCancel)
    cancel_button = dialog.get_by_role("button", name="Cancel")
    if cancel_button.count() == 0:
        # Try alternative selector
        cancel_button = page.locator("button").filter(has_text="Cancel")
    expect(cancel_button.first).to_be_enabled()
    cancel_button.first.click()

    expect(dialog).not_to_be_visible()
    expect(provider_card).to_be_visible()

    # Cleanup
    try:
        delete_provider_api(
            page.context.request,
            provider_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
    except Exception:
        pass


def test_provider_delete_confirm_removes_provider(page: Page, base_url: str) -> None:
    """Ensure delete dialog confirm removes provider."""
    provider_name, provider_id = create_provider_via_ui(
        page,
        base_url,
        name=generate_unique_provider_name("Confirm Delete Provider"),
        description="Provider for confirm delete test.",
        api_key="test-api-key-confirm-delete",
    )

    provider_card = page.locator(
        f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
    )
    expect(provider_card).to_be_visible()

    delete_button = provider_card.get_by_test_id("btn-delete-provider")
    delete_button.click()

    dialog = page.get_by_test_id("dialog-delete-provider")
    dialog.wait_for(state="visible", timeout=10000)
    expect(dialog).to_be_visible()

    # Verify dialog shows correct provider name
    expect(dialog.get_by_text(provider_name)).to_be_visible()

    # Find confirm/delete button
    confirm_button = dialog.get_by_role("button", name="Delete")
    if confirm_button.count() == 0:
        # Try alternative selector
        confirm_button = page.locator("button").filter(has_text="Delete")
    expect(confirm_button.first).to_be_enabled()
    confirm_button.first.click()

    page.wait_for_timeout(500)
    expect(provider_card).to_have_count(0)


def test_provider_delete_with_models_warning(page: Page, base_url: str) -> None:
    """Test provider deletion with models shows warning."""
    provider_name = None
    provider_id = None

    try:
        provider_name, provider_id = create_provider_via_ui(
            page,
            base_url,
            name=generate_unique_provider_name("Provider With Models"),
            description="Provider with models for delete test.",
            api_key="test-api-key-with-models",
        )

        # Create a model for this provider via API
        from server.tests.e2e.providers.helpers import create_model_api

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name="Test Model for Delete",
            description="Model to test provider deletion.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Refresh page to see the model
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(provider_card).to_be_visible()

        delete_button = provider_card.get_by_test_id("btn-delete-provider")
        delete_button.click()

        dialog = page.get_by_test_id("dialog-delete-provider")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        # Verify warning message about models
        warning_text = page.get_by_text("associated models")
        expect(warning_text).to_be_visible()

        # Confirm deletion
        confirm_button = dialog.get_by_role("button", name="Delete")
        if confirm_button.count() == 0:
            confirm_button = page.locator("button").filter(has_text="Delete")
        confirm_button.first.click()

        page.wait_for_timeout(500)
        expect(provider_card).to_have_count(0)

    finally:
        # Cleanup (provider should already be deleted, but model might remain)
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

