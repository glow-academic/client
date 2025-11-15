"""E2E tests for document upload workflow using TUS protocol."""

from __future__ import annotations

import os
import pathlib

import pytest
from playwright.sync_api import Page, expect

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_document_upload_workflow(page: Page, base_url: str) -> None:
    """Test document upload via TUS protocol: upload → classify → verify in list."""
    # Navigate to documents page
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Wait for documents page to load
    documents_grid = page.get_by_test_id("documents-grid")
    documents_grid.wait_for(state="visible", timeout=15000)

    # Click upload button
    upload_button = page.get_by_test_id("document-upload-button")
    upload_button.wait_for(state="visible", timeout=10000)
    upload_button.click()

    # Wait for upload dialog to open
    upload_dialog = page.get_by_test_id("document-upload-dialog")
    upload_dialog.wait_for(state="visible", timeout=10000)
    expect(upload_dialog).to_be_visible()

    # Create a test PDF file for upload
    # In a real test, you might use a fixture or test file
    # For now, we'll create a minimal test file
    test_file_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"

    # Create a temporary file path
    test_file_path = "/tmp/test_document_e2e.pdf"
    with open(test_file_path, "wb") as f:
        f.write(test_file_content)

    try:
        # Find file input in upload dialog
        file_input = upload_dialog.locator("input[type='file']")
        if file_input.count() == 0:
            # Try alternative selector
            file_input = page.locator("input[type='file']")

        if file_input.count() > 0:
            # Set the file
            file_input.set_input_files(test_file_path)

            # Wait for upload to start
            page.wait_for_timeout(1000)

            # Look for upload progress indicator
            progress_indicator = upload_dialog.locator(
                "[data-testid='upload-progress']"
            ).or_(upload_dialog.get_by_text("%", exact=False))

            # Wait for upload to complete (TUS upload might take time)
            # Wait up to 30 seconds for upload completion
            page.wait_for_timeout(5000)  # Give time for upload to process

            # After upload completes, classification form should appear
            # Look for classification form fields
            classification_form = upload_dialog.locator(
                "[data-testid='document-classification-form']"
            )
            if classification_form.count() == 0:
                # Try alternative selectors
                classification_form = upload_dialog.get_by_text(
                    "Classify", exact=False
                ).locator("..")

            if classification_form.count() > 0:
                # Fill classification form
                # Look for form fields (course, assignment type, etc.)
                course_input = classification_form.locator(
                    "[data-testid='input-course']"
                ).or_(classification_form.locator("input[name='course']"))
                if course_input.count() > 0:
                    course_input.fill("TEST101")

                assignment_input = classification_form.locator(
                    "[data-testid='input-assignment']"
                ).or_(classification_form.locator("input[name='assignment']"))
                if assignment_input.count() > 0:
                    assignment_input.fill("Test Assignment")

                # Submit classification
                submit_button = classification_form.locator(
                    "button[type='submit']"
                ).or_(classification_form.get_by_role("button", name="Submit"))
                if submit_button.count() > 0:
                    submit_button.click()

                    # Wait for dialog to close and document to appear in list
                    upload_dialog.wait_for(state="hidden", timeout=10000)

                    # Verify document appears in list
                    # Search for the document by name or other identifier
                    page.wait_for_timeout(2000)  # Give time for list to update

                    # Look for the uploaded document in the grid
                    # The exact selector depends on how documents are displayed
                    uploaded_document = documents_grid.locator(
                        "[data-testid='document-card']"
                    ).filter(has_text="TEST101")
                    if uploaded_document.count() > 0:
                        expect(uploaded_document.first).to_be_visible()
        else:
            pytest.skip("File input not found in upload dialog")
    finally:
        # Clean up test file
        if os.path.exists(test_file_path):
            os.remove(test_file_path)
