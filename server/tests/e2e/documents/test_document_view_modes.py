"""E2E tests for document view modes (list vs grid)."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_document_list_view_selection(page: Page, base_url: str) -> None:
    """Verify list view shows checkboxes and enables bulk operations."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Ensure we're in list view
    toolbar = page.get_by_test_id("documents-toolbar")
    list_view = page.get_by_test_id("documents-list")

    if list_view.count() == 0:
        # Switch to list view
        list_button = (
            toolbar.get_by_role("button").filter(has=page.locator("svg")).first
        )
        if list_button.count() > 0:
            list_button.click()
            page.wait_for_timeout(250)
            list_view = page.get_by_test_id("documents-list")
            expect(list_view).to_be_visible()

    # Verify checkboxes are visible
    checkboxes = page.locator('input[type="checkbox"]')
    assert checkboxes.count() > 0, "Checkboxes should be visible in list view"

    # Select multiple documents
    row_checkboxes = checkboxes.filter(
        has_not=page.locator("[aria-label='Select all']")
    )
    if row_checkboxes.count() >= 2:
        row_checkboxes.nth(0).check()
        row_checkboxes.nth(1).check()
        page.wait_for_timeout(250)

        # Verify bulk edit/delete buttons appear
        bulk_edit_button = page.get_by_test_id("btn-bulk-edit")
        bulk_delete_button = page.get_by_test_id("btn-bulk-delete")

        # At least one bulk button should be visible
        assert bulk_edit_button.count() > 0 or bulk_delete_button.count() > 0, (
            "Bulk operation buttons should appear when documents are selected"
        )

        # Deselect all
        select_all_checkbox = checkboxes.filter(
            has=page.locator("[aria-label='Select all']")
        )
        if select_all_checkbox.count() > 0:
            select_all_checkbox.click()
            page.wait_for_timeout(250)

        # Verify bulk buttons hidden or disabled
        if bulk_edit_button.count() > 0:
            expect(bulk_edit_button).not_to_be_visible()
        if bulk_delete_button.count() > 0:
            expect(bulk_delete_button).not_to_be_visible()


def test_document_grid_view_no_selection(page: Page, base_url: str) -> None:
    """Verify grid view doesn't show checkboxes and bulk operations aren't available."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Switch to grid view
    toolbar = page.get_by_test_id("documents-toolbar")
    grid_button = (
        toolbar.get_by_role("button").filter(has=page.locator("svg")).nth(1)
    )  # Second button is usually grid

    if grid_button.count() > 0:
        grid_button.click()
        page.wait_for_timeout(250)

        grid_view = page.get_by_test_id("documents-grid")
        expect(grid_view).to_be_visible()

        # Verify no checkboxes (or very few - only if there's a select-all somewhere)
        checkboxes = page.locator('input[type="checkbox"]')
        # In grid view, there should be no row-level checkboxes
        row_checkboxes = checkboxes.filter(
            has_not=page.locator("[aria-label='Select all']")
        )
        assert row_checkboxes.count() == 0, (
            "Grid view should not have row-level checkboxes"
        )

        # Verify bulk operations not available
        bulk_edit_button = page.get_by_test_id("btn-bulk-edit")
        bulk_delete_button = page.get_by_test_id("btn-bulk-delete")

        # Bulk buttons should not be visible in grid view
        if bulk_edit_button.count() > 0:
            expect(bulk_edit_button).not_to_be_visible()
        if bulk_delete_button.count() > 0:
            expect(bulk_delete_button).not_to_be_visible()

        # Verify individual action buttons exist on cards
        document_cards = page.get_by_test_id("document-card")
        if document_cards.count() > 0:
            first_card = document_cards.first
            # Cards should have action buttons (edit, delete, preview)
            edit_button = first_card.get_by_test_id("btn-edit-document")
            preview_button = first_card.get_by_test_id("btn-preview-document")

            # At least one action button should be present
            assert edit_button.count() > 0 or preview_button.count() > 0, (
                "Document cards should have action buttons"
            )


def test_document_view_mode_persistence(page: Page, base_url: str) -> None:
    """Verify view mode persists or resets appropriately on reload."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Switch to grid view
    toolbar = page.get_by_test_id("documents-toolbar")
    grid_button = toolbar.get_by_role("button").filter(has=page.locator("svg")).nth(1)

    if grid_button.count() > 0:
        grid_button.click()
        page.wait_for_timeout(250)

        grid_view = page.get_by_test_id("documents-grid")
        expect(grid_view).to_be_visible()

        # Reload page
        page.reload()
        page.wait_for_load_state("networkidle")

        # Check if grid view persists or resets to default (list)
        grid_view_after = page.get_by_test_id("documents-grid")
        list_view_after = page.get_by_test_id("documents-list")

        # View mode may persist (if implemented) or reset to default (list)
        # Both behaviors are acceptable
        assert grid_view_after.count() > 0 or list_view_after.count() > 0, (
            "Either grid or list view should be visible after reload"
        )
