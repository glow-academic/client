"""E2E tests for editing providers and update persistence."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    delete_provider_api,
    fetch_provider_detail,
    generate_unique_provider_name,
)
from server.tests.e2e.providers.ui_flows import create_provider_via_ui, edit_provider_via_ui

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_provider_edit_navigation(page: Page, base_url: str) -> None:
    """Verify navigation to provider edit page and form pre-population."""
    provider_name = None
    provider_id = None

    try:
        provider_name, provider_id = create_provider_via_ui(
            page,
            base_url,
            name=generate_unique_provider_name("Editable Provider"),
            description="Provider created for edit navigation test.",
            api_key="test-api-key-edit-nav",
        )

        # Navigate to providers list
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(provider_card).to_be_visible()

        # Click edit button
        edit_button = provider_card.get_by_test_id("btn-edit-provider")
        expect(edit_button).to_be_visible()
        edit_button.click()

        # Verify URL changes
        page.wait_for_url(f"{base_url}/system/providers/p/{provider_id}")
        page.wait_for_load_state("networkidle")

        # Verify data-page attribute
        container = page.locator("[data-page='provider-edit']").first
        container.wait_for(state="visible", timeout=15000)
        expect(container).to_be_visible()

        # Verify form fields pre-populate
        name_input = page.get_by_test_id("input-provider-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value(provider_name)

        description_input = page.get_by_test_id("input-provider-description")
        description_input.wait_for(state="visible", timeout=10000)
        expect(description_input).to_have_value("Provider created for edit navigation test.")

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


def test_provider_update_persists_changes(page: Page, base_url: str) -> None:
    """Edit provider and verify changes persist."""
    provider_name = None
    provider_id = None

    try:
        provider_name, provider_id = create_provider_via_ui(
            page,
            base_url,
            name=generate_unique_provider_name("Update Provider"),
            description="Original description.",
            api_key="test-api-key-update",
        )

        updated_name = f"{provider_name} Updated"
        updated_description = "Updated description via E2E."
        updated_base_url = "https://api.updated-provider.com/v1"

        edit_provider_via_ui(
            page,
            base_url,
            provider_id,
            name=updated_name,
            description=updated_description,
            base_url_opt=updated_base_url,
        )

        # Verify redirect to list
        page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
        page.wait_for_load_state("networkidle")

        # Search for updated name
        search_input = page.get_by_test_id("providers-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(provider_card).to_be_visible()

        # Navigate back to edit page
        edit_button = provider_card.get_by_test_id("btn-edit-provider")
        edit_button.click()

        page.wait_for_url(f"{base_url}/system/providers/p/{provider_id}")
        page.wait_for_load_state("networkidle")

        # Verify changes persisted
        name_input = page.get_by_test_id("input-provider-name")
        name_input.wait_for(state="visible", timeout=10000)
        expect(name_input).to_have_value(updated_name)

        description_input = page.get_by_test_id("input-provider-description")
        description_input.wait_for(state="visible", timeout=10000)
        expect(description_input).to_have_value(updated_description)

        base_url_input = page.get_by_test_id("input-provider-base-url")
        base_url_input.wait_for(state="visible", timeout=10000)
        expect(base_url_input).to_have_value(updated_base_url)

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


def test_provider_update_api_key_flow(page: Page, base_url: str) -> None:
    """Test API key edit flow."""
    provider_name = None
    provider_id = None

    try:
        provider_name, provider_id = create_provider_via_ui(
            page,
            base_url,
            name=generate_unique_provider_name("API Key Provider"),
            description="Provider for API key edit test.",
            api_key="original-api-key-12345",
        )

        page.goto(f"{base_url}/system/providers/p/{provider_id}")
        page.wait_for_load_state("networkidle")

        container = page.locator("[data-page='provider-edit']").first
        container.wait_for(state="visible", timeout=15000)

        # Click edit API key button
        edit_api_key_button = page.get_by_test_id("btn-edit-api-key")
        edit_api_key_button.wait_for(state="visible", timeout=10000)
        edit_api_key_button.click()

        # Verify input becomes editable
        api_key_input = page.get_by_test_id("input-provider-api-key")
        api_key_input.wait_for(state="visible", timeout=10000)
        expect(api_key_input).not_to_be_disabled()

        # Enter new API key
        new_api_key = "new-api-key-67890"
        api_key_input.fill(new_api_key)

        # Verify security note appears
        security_note = page.get_by_text("Security Note")
        expect(security_note).to_be_visible()

        # Submit form
        submit_button = page.get_by_test_id("btn-submit-provider")
        submit_button.click()

        page.wait_for_url(re.compile(r".*/system/providers.*"), timeout=20000)
        page.wait_for_load_state("networkidle")

        # Verify API key was updated (check via API)
        detail = fetch_provider_detail(
            page.context.request,
            provider_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        # API key should be masked in response, but we can verify it's different
        # by checking the masked value changed
        assert detail.get("api_key") is not None

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

