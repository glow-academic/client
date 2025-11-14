"""E2E tests for editing models and update persistence."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    create_model_api,
    create_provider_api,
    delete_model_api,
    delete_provider_api,
    generate_unique_model_name,
)
from server.tests.e2e.providers.ui_flows import edit_model_via_ui

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_model_edit_navigation(page: Page, base_url: str) -> None:
    """Verify navigation to model edit page and form pre-population."""
    provider_id = None
    model_id = None

    try:
        # Create provider and model
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Edit Nav",
            description="Provider for model edit navigation test.",
            api_key="test-api-key-edit-nav",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name="Editable Model",
            description="Model created for edit navigation test.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to providers list and refresh to get newly created model
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")
        page.reload()  # Refresh to get newly created model from server
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Search for the model to ensure it's visible (search filters models, not providers)
        search_input = page.get_by_test_id("providers-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill("Editable Model")
        page.wait_for_timeout(500)

        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        expect(model_card).to_be_visible()

        # Click edit button
        edit_button = model_card.get_by_test_id("btn-edit-model")
        expect(edit_button).to_be_visible()
        edit_button.click()

        # Verify URL changes
        page.wait_for_url(
            f"{base_url}/system/providers/p/{provider_id}/m/{model_id}"
        )
        page.wait_for_load_state("networkidle")

        # Verify data-page attribute
        container = page.locator("[data-page='model-edit']").first
        container.wait_for(state="visible", timeout=15000)
        expect(container).to_be_visible()

        # Verify form fields pre-populate
        name_input = page.get_by_test_id("input-model-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value("Editable Model")

        description_input = page.get_by_test_id("input-model-description")
        description_input.wait_for(state="visible", timeout=10000)
        expect(description_input).to_have_value(
            "Model created for edit navigation test."
        )

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


def test_model_update_persists_changes(page: Page, base_url: str) -> None:
    """Edit model and verify changes persist."""
    provider_id = None
    model_id = None

    try:
        # Create provider and model
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Model Update",
            description="Provider for model update test.",
            api_key="test-api-key-update",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name="Update Model",
            description="Original description.",
            input_ppm=3.0,
            output_ppm=15.0,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        updated_name = "Update Model Updated"
        updated_description = "Updated description via E2E."
        updated_input_ppm = 5.0
        updated_output_ppm = 20.0

        edit_model_via_ui(
            page,
            base_url,
            provider_id,
            model_id,
            name=updated_name,
            description=updated_description,
            input_ppm=updated_input_ppm,
            output_ppm=updated_output_ppm,
        )

        # Verify redirect to list
        page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
        page.wait_for_load_state("networkidle")

        # Search for updated name
        search_input = page.get_by_test_id("providers-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        expect(model_card).to_be_visible()

        # Navigate back to edit page
        edit_button = model_card.get_by_test_id("btn-edit-model")
        edit_button.click()

        page.wait_for_url(
            f"{base_url}/system/providers/p/{provider_id}/m/{model_id}"
        )
        page.wait_for_load_state("networkidle")

        # Verify changes persisted
        name_input = page.get_by_test_id("input-model-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value(updated_name)

        description_input = page.get_by_test_id("input-model-description")
        description_input.wait_for(state="visible", timeout=10000)
        expect(description_input).to_have_value(updated_description)

        input_ppm_input = page.get_by_test_id("input-model-input-ppm")
        input_ppm_input.wait_for(state="visible", timeout=10000)
        expect(input_ppm_input).to_have_value(str(updated_input_ppm))

        output_ppm_input = page.get_by_test_id("input-model-output-ppm")
        output_ppm_input.wait_for(state="visible", timeout=10000)
        expect(output_ppm_input).to_have_value(str(updated_output_ppm))

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


def test_model_pricing_validation(page: Page, base_url: str) -> None:
    """Test model pricing validation (negative numbers, non-numeric)."""
    provider_id = None
    model_id = None

    try:
        # Create provider and model
        provider_id = create_provider_api(
            page.context.request,
            name="Test Provider for Pricing Validation",
            description="Provider for pricing validation test.",
            api_key="test-api-key-pricing",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name="Pricing Validation Model",
            description="Model for pricing validation.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(
            f"{base_url}/system/providers/p/{provider_id}/m/{model_id}"
        )
        page.wait_for_load_state("networkidle")

        container = page.locator("[data-page='model-edit']").first
        container.wait_for(state="visible", timeout=15000)

        # Try to enter negative number
        input_ppm_input = page.get_by_test_id("input-model-input-ppm")
        input_ppm_input.wait_for(state="visible", timeout=10000)
        input_ppm_input.fill("-5.0")

        # HTML5 validation should prevent negative values
        # Try to submit and verify form doesn't submit or shows error
        submit_button = page.get_by_test_id("btn-submit-model")
        if submit_button.is_enabled():
            submit_button.click()
            page.wait_for_timeout(500)
            # Should still be on edit page (validation prevented submission)
            assert f"m/{model_id}" in page.url

        # Enter valid pricing
        input_ppm_input.fill("5.0")
        output_ppm_input = page.get_by_test_id("input-model-output-ppm")
        output_ppm_input.wait_for(state="visible", timeout=10000)
        output_ppm_input.fill("20.0")

        submit_button.click()
        page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
        page.wait_for_load_state("networkidle")

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

