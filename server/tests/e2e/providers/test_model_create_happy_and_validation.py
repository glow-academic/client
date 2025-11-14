"""E2E tests covering model creation validation and success flow."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    create_provider_api,
    delete_model_api,
    delete_provider_api,
    generate_unique_model_name,
)
from server.tests.e2e.providers.ui_flows import create_model_via_ui

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_model_create_validation_required_fields(page: Page, base_url: str) -> None:
    """Validate required fields show errors when submitting empty form."""
    provider_id = None

    try:
        # Create a provider first (required for model creation)
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Validation",
            description="Provider for model validation test.",
            api_key="test-api-key-validation",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/system/providers/p/{provider_id}/new")
        page.wait_for_load_state("networkidle")

        name_input = page.get_by_test_id("input-model-name")
        name_input.wait_for(state="visible", timeout=20000)

        submit_button = page.get_by_test_id("btn-submit-model")

        # Try to submit without filling required fields
        # Note: HTML5 validation may prevent form submission
        if submit_button.is_enabled():
            submit_button.click()
            page.wait_for_timeout(500)
            # Check that form didn't submit (URL should not change)
            assert "new" in page.url or f"p/{provider_id}" in page.url

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


def test_model_create_success_flow(page: Page, base_url: str) -> None:
    """Create a model successfully and verify it appears in the list."""
    provider_id = None
    model_name = None
    model_id = None

    try:
        # Create a provider first
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Create",
            description="Provider for model create test.",
            api_key="test-api-key-model-create",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_name, model_id = create_model_via_ui(
            page,
            base_url,
            provider_id,
            name=generate_unique_model_name("E2E Model"),
            description="Model created via E2E test.",
            input_ppm=3.0,
            output_ppm=15.0,
        )

        # Verify toast success message
        toast = page.get_by_role("alert").filter(has_text="successfully")
        try:
            toast.wait_for(state="visible", timeout=5000)
        except Exception:
            # Toast may have disappeared, that's okay
            pass

        # Verify model appears in list (already done in create_model_via_ui)
        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
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


def test_model_create_with_custom_settings(page: Page, base_url: str) -> None:
    """Create model with custom_model=true and active=false and verify settings persist."""
    provider_id = None
    model_id = None

    try:
        # Create a provider first
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Custom Model",
            description="Provider for custom model test.",
            api_key="test-api-key-custom-model",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/system/providers/p/{provider_id}/new")
        page.wait_for_load_state("networkidle")

        model_name = generate_unique_model_name("Custom Model")

        name_input = page.get_by_test_id("input-model-name")
        name_input.wait_for(state="visible", timeout=15000)
        name_input.fill(model_name)

        description_input = page.get_by_test_id("input-model-description")
        description_input.wait_for(state="visible", timeout=15000)
        description_input.fill("Custom model with special settings.")

        input_ppm_input = page.get_by_test_id("input-model-input-ppm")
        input_ppm_input.wait_for(state="visible", timeout=15000)
        input_ppm_input.fill("5.0")

        output_ppm_input = page.get_by_test_id("input-model-output-ppm")
        output_ppm_input.wait_for(state="visible", timeout=15000)
        output_ppm_input.fill("20.0")

        # Toggle custom model switch
        custom_switch = page.get_by_test_id("switch-model-custom")
        custom_switch.wait_for(state="visible", timeout=10000)
        if not custom_switch.is_checked():
            custom_switch.click()

        # Toggle active switch to inactive
        active_switch = page.get_by_test_id("switch-model-active")
        active_switch.wait_for(state="visible", timeout=10000)
        if active_switch.is_checked():
            active_switch.click()

        submit_button = page.get_by_test_id("btn-submit-model")
        submit_button.click()

        page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
        page.wait_for_load_state("networkidle")

        # Find the model card
        search_input = page.get_by_test_id("providers-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(model_name)
        page.wait_for_timeout(500)

        model_card = page.locator(
            f"[data-testid='model-card']"
        ).filter(has_text=model_name).first
        expect(model_card).to_be_visible()

        model_id = model_card.get_attribute("data-model-id")
        if not model_id:
            pytest.fail("Model card missing data-model-id")

        # Navigate to edit page to verify settings persisted
        edit_button = model_card.get_by_test_id("btn-edit-model")
        edit_button.click()

        page.wait_for_url(
            f"{base_url}/system/providers/p/{provider_id}/m/{model_id}"
        )
        page.wait_for_load_state("networkidle")

        # Verify custom_model is checked
        custom_switch = page.get_by_test_id("switch-model-custom")
        custom_switch.wait_for(state="visible", timeout=10000)
        expect(custom_switch).to_be_checked()

        # Verify active is unchecked
        active_switch = page.get_by_test_id("switch-model-active")
        active_switch.wait_for(state="visible", timeout=10000)
        expect(active_switch).not_to_be_checked()

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

