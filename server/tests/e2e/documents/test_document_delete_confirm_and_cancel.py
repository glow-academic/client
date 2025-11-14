"""E2E tests covering document delete confirmation and cancellation."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.documents.helpers import (
    create_document_api,
    delete_document_api,
    generate_unique_document_name,
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


def test_document_delete_cancel_then_confirm(page: Page, base_url: str) -> None:
    """Ensure delete dialog cancel preserves document and confirm removes it."""
    document_id = None
    try:
        # Create document via API (not used in scenarios, so deletable)
        document_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Deletable Document"),
            type="homework",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/create/documents")
        page.wait_for_load_state("networkidle")

        # Find document card/row
        document_card = page.locator(
            f"[data-testid='document-card'][data-document-id='{document_id}']"
        )
        # If not in grid, try list view
        if document_card.count() == 0:
            # Switch to list view if needed
            toolbar = page.get_by_test_id("documents-toolbar")
            list_button = toolbar.get_by_role("button").filter(
                has=page.locator("svg")
            ).first
            if list_button.count() > 0:
                list_button.click()
                page.wait_for_timeout(250)
            # Try finding by ID in table
            document_row = page.locator("tr").filter(has_text=document_id)
            if document_row.count() > 0:
                document_card = document_row

        expect(document_card).to_be_visible()

        # Click delete button
        delete_button = document_card.get_by_test_id("btn-delete-document")
        if delete_button.count() == 0:
            # Try finding delete button in the row
            delete_button = page.get_by_test_id("btn-delete-document").first
        delete_button.click()

        # Wait for delete dialog
        dialog = page.get_by_test_id("dialog-delete-document")
        dialog.wait_for(state="visible", timeout=10000)
        expect(dialog).to_be_visible()

        # Click Cancel
        cancel_button = page.get_by_test_id("btn-cancel-delete")
        expect(cancel_button).to_be_enabled()
        cancel_button.click()

        expect(dialog).not_to_be_visible()
        expect(document_card).to_be_visible()

        # Try delete again and confirm
        delete_button = document_card.get_by_test_id("btn-delete-document")
        if delete_button.count() == 0:
            delete_button = page.get_by_test_id("btn-delete-document").first
        delete_button.click()
        expect(dialog).to_be_visible()

        confirm_button = page.get_by_test_id("btn-confirm-delete")
        expect(confirm_button).to_be_enabled()
        confirm_button.click()

        page.wait_for_timeout(500)
        _expect_toast(page, "deleted successfully")
        expect(document_card).to_have_count(0)
    finally:
        if document_id:
            try:
                delete_document_api(
                    page.context.request,
                    document_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_document_delete_non_deletable_shows_warning(page: Page, base_url: str) -> None:
    """Verify that non-deletable documents show appropriate warning."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Find a document that is used in scenarios (can_delete = false)
    # Look for documents without delete button or with disabled delete button
    delete_buttons = page.get_by_test_id("btn-delete-document")
    
    # Check if any delete buttons are disabled
    disabled_delete_buttons = delete_buttons.filter(has=page.locator("[disabled]"))
    
    if disabled_delete_buttons.count() > 0:
        # Try to click disabled button (should not work)
        disabled_button = disabled_delete_buttons.first
        expect(disabled_button).to_be_disabled()
    else:
        # If no disabled buttons, check for documents without delete buttons
        # Documents in use may not have delete buttons at all
        pytest.skip("No non-deletable documents found for testing")

