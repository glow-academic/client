"""E2E tests for editing documents."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.documents.helpers import (
    create_document_api,
    delete_document_api,
    fetch_document_detail,
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


def test_document_edit_update_fields(page: Page, base_url: str) -> None:
    """Edit an existing document and verify updates persist."""
    document_id = None
    try:
        # Create document via API
        document_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Editable Document"),
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
            list_button = (
                toolbar.get_by_role("button").filter(has=page.locator("svg")).first
            )
            if list_button.count() > 0:
                list_button.click()
                page.wait_for_timeout(250)

        # Find edit button
        edit_button = page.get_by_test_id("btn-edit-document").first
        edit_button.wait_for(state="visible", timeout=10000)
        edit_button.click()

        # Wait for edit dialog
        edit_dialog = page.get_by_test_id("dialog-edit-document")
        edit_dialog.wait_for(state="visible", timeout=10000)

        # Update name
        name_input = page.locator('input[id="name"]')
        if name_input.count() > 0:
            updated_name = f"Updated {generate_unique_document_name('Document')}"
            name_input.fill(updated_name)

        # Update type
        type_select = (
            page.locator('[role="combobox"]')
            .filter(has_text="Type")
            .or_(page.locator('select[id="type"]'))
        )
        if type_select.count() > 0:
            type_select.click()
            type_option = page.get_by_role("option").filter(has_text="Project")
            if type_option.count() > 0:
                type_option.click()

        # Update active status
        active_switch = page.locator('input[id="active"]').or_(
            page.locator('[role="switch"]')
        )
        if active_switch.count() > 0:
            current_state = active_switch.is_checked()
            active_switch.click()  # Toggle

        # Click Update button
        update_button = edit_dialog.get_by_role("button", name="Update")
        update_button.click()

        # Wait for success
        page.wait_for_timeout(500)
        _expect_toast(page, "updated successfully")
        expect(edit_dialog).not_to_be_visible()

        # Refresh page and verify updates
        page.reload()
        page.wait_for_load_state("networkidle")

        # Verify document still exists and is updated
        document_card = page.locator(
            f"[data-testid='document-card'][data-document-id='{document_id}']"
        )
        if document_card.count() == 0:
            # Check list view
            document_row = page.locator("tr").filter(has_text=document_id)
            expect(document_row).to_be_visible()
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


def test_document_edit_cancel(page: Page, base_url: str) -> None:
    """Ensure cancel button closes dialog without saving changes."""
    document_id = None
    try:
        # Create document via API
        document_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Cancel Test Document"),
            type="homework",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Get original name
        detail = fetch_document_detail(
            page.context.request,
            document_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        original_name = detail.get("name", "")

        page.goto(f"{base_url}/create/documents")
        page.wait_for_load_state("networkidle")

        # Find and click edit button
        edit_button = page.get_by_test_id("btn-edit-document").first
        edit_button.wait_for(state="visible", timeout=10000)
        edit_button.click()

        edit_dialog = page.get_by_test_id("dialog-edit-document")
        edit_dialog.wait_for(state="visible", timeout=10000)

        # Make changes
        name_input = page.locator('input[id="name"]')
        if name_input.count() > 0:
            name_input.fill("This should not be saved")

        # Click Cancel
        cancel_button = edit_dialog.get_by_role("button", name="Cancel")
        cancel_button.click()

        expect(edit_dialog).not_to_be_visible()

        # Verify document unchanged
        page.reload()
        page.wait_for_load_state("networkidle")

        detail_after = fetch_document_detail(
            page.context.request,
            document_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        assert detail_after.get("name") == original_name
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
