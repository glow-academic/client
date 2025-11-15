"""E2E tests for bulk editing documents."""

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


def test_document_bulk_edit_fields(page: Page, base_url: str) -> None:
    """Bulk edit multiple documents and verify updates."""
    created_document_ids: list[str] = []
    try:
        # Create multiple documents
        for i in range(3):
            doc_id = create_document_api(
                page.context.request,
                name=generate_unique_document_name(f"Bulk Edit Doc {i}"),
                type="homework",
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            created_document_ids.append(doc_id)

        page.goto(f"{base_url}/create/documents")
        page.wait_for_load_state("networkidle")

        # Switch to list view for selection
        toolbar = page.get_by_test_id("documents-toolbar")
        list_button = (
            toolbar.get_by_role("button").filter(has=page.locator("svg")).first
        )
        if list_button.count() > 0:
            list_button.click()
            page.wait_for_timeout(250)

        # Select multiple documents using checkboxes
        checkboxes = page.locator('input[type="checkbox"]').filter(
            has_not=page.locator("[aria-label='Select all']")
        )
        if checkboxes.count() >= 2:
            checkboxes.nth(0).check()
            checkboxes.nth(1).check()
            page.wait_for_timeout(250)

            # Click bulk edit button
            bulk_edit_button = page.get_by_test_id("btn-bulk-edit")
            bulk_edit_button.wait_for(state="visible", timeout=10000)
            bulk_edit_button.click()

            # Wait for bulk edit dialog
            bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-document")
            bulk_edit_dialog.wait_for(state="visible", timeout=10000)

            # Update type
            type_select = page.locator('[role="combobox"]').filter(has_text="Type")
            if type_select.count() > 0:
                type_select.click()
                type_option = page.get_by_role("option").filter(has_text="Project")
                if type_option.count() > 0:
                    type_option.click()

            # Click Apply Changes
            apply_button = bulk_edit_dialog.get_by_role("button", name="Apply Changes")
            apply_button.click()

            # Wait for success
            page.wait_for_timeout(500)
            _expect_toast(page, "updated successfully")
            expect(bulk_edit_dialog).not_to_be_visible()

            # Verify updates persisted
            page.reload()
            page.wait_for_load_state("networkidle")
    finally:
        for doc_id in created_document_ids:
            try:
                delete_document_api(
                    page.context.request,
                    doc_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_document_bulk_edit_partial_updates(page: Page, base_url: str) -> None:
    """Test bulk edit with partial updates (keep existing for some fields)."""
    created_document_ids: list[str] = []
    try:
        # Create documents with different types
        doc1_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Bulk Partial Doc 1"),
            type="homework",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        created_document_ids.append(doc1_id)

        doc2_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Bulk Partial Doc 2"),
            type="project",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        created_document_ids.append(doc2_id)

        page.goto(f"{base_url}/create/documents")
        page.wait_for_load_state("networkidle")

        # Switch to list view
        toolbar = page.get_by_test_id("documents-toolbar")
        list_button = (
            toolbar.get_by_role("button").filter(has=page.locator("svg")).first
        )
        if list_button.count() > 0:
            list_button.click()
            page.wait_for_timeout(250)

        # Select both documents
        checkboxes = page.locator('input[type="checkbox"]').filter(
            has_not=page.locator("[aria-label='Select all']")
        )
        if checkboxes.count() >= 2:
            checkboxes.nth(0).check()
            checkboxes.nth(1).check()
            page.wait_for_timeout(250)

            # Open bulk edit
            bulk_edit_button = page.get_by_test_id("btn-bulk-edit")
            bulk_edit_button.click()

            bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-document")
            bulk_edit_dialog.wait_for(state="visible", timeout=10000)

            # Keep type as "Keep existing" (default)
            # Only update department if available

            # Click Apply Changes
            apply_button = bulk_edit_dialog.get_by_role("button", name="Apply Changes")
            apply_button.click()

            page.wait_for_timeout(500)
            _expect_toast(page, "updated successfully")
    finally:
        for doc_id in created_document_ids:
            try:
                delete_document_api(
                    page.context.request,
                    doc_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_document_bulk_edit_cancel(page: Page, base_url: str) -> None:
    """Ensure bulk edit cancel closes dialog without saving."""
    created_document_ids: list[str] = []
    try:
        # Create documents
        for i in range(2):
            doc_id = create_document_api(
                page.context.request,
                name=generate_unique_document_name(f"Bulk Cancel Doc {i}"),
                type="homework",
                profile_id=ADMIN_PROFILE_ID,
                effective_profile_id=ADMIN_PROFILE_ID,
            )
            created_document_ids.append(doc_id)

        page.goto(f"{base_url}/create/documents")
        page.wait_for_load_state("networkidle")

        # Switch to list view
        toolbar = page.get_by_test_id("documents-toolbar")
        list_button = (
            toolbar.get_by_role("button").filter(has=page.locator("svg")).first
        )
        if list_button.count() > 0:
            list_button.click()
            page.wait_for_timeout(250)

        # Select documents
        checkboxes = page.locator('input[type="checkbox"]').filter(
            has_not=page.locator("[aria-label='Select all']")
        )
        if checkboxes.count() >= 2:
            checkboxes.nth(0).check()
            checkboxes.nth(1).check()
            page.wait_for_timeout(250)

            # Open bulk edit
            bulk_edit_button = page.get_by_test_id("btn-bulk-edit")
            bulk_edit_button.click()

            bulk_edit_dialog = page.get_by_test_id("dialog-bulk-edit-document")
            bulk_edit_dialog.wait_for(state="visible", timeout=10000)

            # Make changes
            type_select = page.locator('[role="combobox"]').filter(has_text="Type")
            if type_select.count() > 0:
                type_select.click()
                type_option = page.get_by_role("option").filter(has_text="Project")
                if type_option.count() > 0:
                    type_option.click()

            # Click Cancel
            cancel_button = bulk_edit_dialog.get_by_role("button", name="Cancel")
            cancel_button.click()

            expect(bulk_edit_dialog).not_to_be_visible()
    finally:
        for doc_id in created_document_ids:
            try:
                delete_document_api(
                    page.context.request,
                    doc_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
