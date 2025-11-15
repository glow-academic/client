"""UI flow helpers for document E2E tests."""

from __future__ import annotations

import re
import sys
from typing import Optional, Tuple

from playwright.sync_api import Page, expect

from server.tests.e2e.documents.helpers import generate_unique_document_name


def edit_document_via_ui(
    page: Page,
    base_url: str,
    document_id: str,
    updates: dict,
) -> None:
    """Edit a document through the UI."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Find document card/row
    document_card = page.locator(
        f"[data-testid='document-card'][data-document-id='{document_id}']"
    )
    # If not found in grid, try list view
    if document_card.count() == 0:
        # In list view, find by document ID in table row
        document_row = page.locator(f"tr").filter(has_text=document_id)
        if document_row.count() == 0:
            raise AssertionError(f"Document {document_id} not found in UI")

    # Click edit button
    edit_button = page.get_by_test_id("btn-edit-document").first
    edit_button.wait_for(state="visible", timeout=10000)
    edit_button.click()

    # Wait for edit dialog
    edit_dialog = page.get_by_test_id("dialog-edit-document")
    edit_dialog.wait_for(state="visible", timeout=10000)

    # Update fields based on updates dict
    if "name" in updates:
        name_input = page.locator('input[id="name"]')
        if name_input.count() > 0:
            name_input.fill(updates["name"])

    if "type" in updates:
        type_select = page.locator('select, [role="combobox"]').filter(
            has_text=updates.get("type", "")
        )
        if type_select.count() > 0:
            type_select.click()
            type_option = page.get_by_role("option").filter(has_text=updates["type"])
            type_option.click()

    if "active" in updates:
        active_switch = page.locator('input[id="active"], [role="switch"]')
        if active_switch.count() > 0:
            current_state = active_switch.is_checked()
            if current_state != updates["active"]:
                active_switch.click()

    # Click Update button
    update_button = edit_dialog.get_by_role("button", name="Update")
    update_button.click()

    # Wait for success and dialog to close
    page.wait_for_timeout(500)
    expect(edit_dialog).not_to_be_visible()


def delete_document_via_ui(
    page: Page,
    base_url: str,
    document_id: str,
    confirm: bool = True,
) -> None:
    """Delete a document through the UI."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Find document card/row
    document_card = page.locator(
        f"[data-testid='document-card'][data-document-id='{document_id}']"
    )
    if document_card.count() == 0:
        # Try finding in list view
        document_row = page.locator("tr").filter(has_text=document_id)
        if document_row.count() == 0:
            raise AssertionError(f"Document {document_id} not found in UI")

    # Click delete button
    delete_button = page.get_by_test_id("btn-delete-document").first
    delete_button.wait_for(state="visible", timeout=10000)
    delete_button.click()

    # Wait for delete dialog
    delete_dialog = page.get_by_test_id("dialog-delete-document")
    delete_dialog.wait_for(state="visible", timeout=10000)

    if confirm:
        # Click confirm
        confirm_button = page.get_by_test_id("btn-confirm-delete")
        confirm_button.click()
        page.wait_for_timeout(500)
        expect(delete_dialog).not_to_be_visible()
    else:
        # Click cancel
        cancel_button = page.get_by_test_id("btn-cancel-delete")
        cancel_button.click()
        expect(delete_dialog).not_to_be_visible()
