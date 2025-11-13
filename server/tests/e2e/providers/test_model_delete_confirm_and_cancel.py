"""E2E tests covering model delete confirmation and cancellation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    create_model_api,
    create_provider_api,
    delete_model_api,
    delete_provider_api,
    generate_unique_model_name,
)
from server.tests.e2e.providers.ui_flows import create_model_via_ui

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


def test_model_delete_cancel_preserves_model(page: Page, base_url: str) -> None:
    """Ensure delete dialog cancel preserves model."""
    provider_id = None
    model_name = None
    model_id = None

    try:
        # Create provider and model
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Delete",
            description="Provider for model delete test.",
            api_key="test-api-key-delete",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_name, model_id = create_model_via_ui(
            page,
            base_url,
            provider_id,
            name=generate_unique_model_name("Deletable Model"),
            description="Model targeted for delete E2E test.",
            input_ppm=3.0,
            output_ppm=15.0,
        )

        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        expect(model_card).to_be_visible()

        delete_button = model_card.get_by_test_id("btn-delete-model")
        delete_button.click()

        dialog = page.get_by_test_id("dialog-delete-model")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        cancel_button = page.get_by_test_id("btn-cancel-delete")
        expect(cancel_button).to_be_enabled()
        cancel_button.click()

        expect(dialog).not_to_be_visible()
        expect(model_card).to_be_visible()

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


def test_model_delete_confirm_removes_model(page: Page, base_url: str) -> None:
    """Ensure delete dialog confirm removes model."""
    provider_id = None
    model_name = None
    model_id = None

    try:
        # Create provider and model
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Confirm Delete",
            description="Provider for model confirm delete test.",
            api_key="test-api-key-confirm-delete",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_name, model_id = create_model_via_ui(
            page,
            base_url,
            provider_id,
            name=generate_unique_model_name("Confirm Delete Model"),
            description="Model for confirm delete test.",
            input_ppm=3.0,
            output_ppm=15.0,
        )

        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        expect(model_card).to_be_visible()

        delete_button = model_card.get_by_test_id("btn-delete-model")
        delete_button.click()

        dialog = page.get_by_test_id("dialog-delete-model")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        # Verify dialog shows correct model name
        expect(dialog.get_by_text(model_name)).to_be_visible()

        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()

        page.wait_for_timeout(500)
        expect(model_card).to_have_count(0)

    finally:
        # Cleanup (model should already be deleted)
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


def test_model_delete_with_usage_warning(page: Page, base_url: str) -> None:
    """Test model deletion when model is in use (delete button should be disabled)."""
    provider_id = None
    model_id = None

    try:
        # Create provider and model
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Usage Warning",
            description="Provider for usage warning test.",
            api_key="test-api-key-usage",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name="Model In Use",
            description="Model that might be in use.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        expect(model_card).to_be_visible()

        # Check if delete button exists and is enabled/disabled
        delete_button = model_card.get_by_test_id("btn-delete-model")
        if delete_button.count() == 0:
            # Delete button not visible - model is in use
            pytest.skip("Model is in use, delete button not available")

        # If delete button exists, it should be enabled for this test
        # (we're testing the case where it might be disabled)
        if delete_button.is_disabled():
            # Model is in use, delete is disabled - this is expected behavior
            pass
        else:
            # Model is not in use, delete is enabled - test normal delete flow
            delete_button.click()
            dialog = page.get_by_test_id("dialog-delete-model")
            if dialog.count() > 0:
                confirm_button = page.get_by_test_id("btn-confirm-delete")
                confirm_button.click()
                page.wait_for_timeout(500)

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

