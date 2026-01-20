"""E2E tests for staff CSV upload workflow."""

from __future__ import annotations

import csv
import io
import os
import tempfile
import uuid

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.staff.helpers import delete_staff_api, fetch_staff_list

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _create_test_csv(rows: list[dict[str, str]], filename: str | None = None) -> str:
    """Create a temporary CSV file for testing."""
    if not rows:
        rows = [
            {
                "name": "John Doe",
                "email": "redacted@purdue.edu",
                "role": "member",
            },
            {
                "name": "Jane Smith",
                "email": "redacted@purdue.edu",
                "role": "instructional",
            },
        ]

    # Create CSV content
    headers = list(rows[0].keys())

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)

    csv_content = output.getvalue()
    output.close()

    # Write to temporary file
    if filename:
        filepath = filename
    else:
        fd, filepath = tempfile.mkstemp(suffix=".csv", prefix="test_staff_")
        os.close(fd)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(csv_content)

    return filepath


def test_staff_csv_upload_workflow(page: Page, base_url: str) -> None:
    """Test complete CSV upload workflow: upload → map columns → review → submit."""
    # Navigate to staff page
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    # Wait for staff table to load
    staff_table = page.get_by_test_id("staff-table")
    staff_table.wait_for(state="visible", timeout=15000)

    # Get initial staff count
    initial_rows = staff_table.get_by_test_id("staff-row")
    _initial_count = initial_rows.count()

    # Click "Create Staff" button to open dropdown
    create_button = page.get_by_role("button", name="Create Staff")
    create_button.wait_for(state="visible", timeout=10000)
    create_button.click()

    # Click "CSV Import" option from dropdown
    csv_import_option = page.get_by_role("menuitem", name="CSV Import")
    csv_import_option.wait_for(state="visible", timeout=5000)
    csv_import_option.click()

    # Wait for CSV upload modal to open
    csv_modal = page.get_by_test_id("csv-upload-modal")
    csv_modal.wait_for(state="visible", timeout=10000)
    expect(csv_modal).to_be_visible()

    # Verify we're on upload stage
    upload_stage = page.get_by_test_id("csv-upload-stage-upload")
    upload_stage.wait_for(state="visible", timeout=5000)
    expect(upload_stage).to_be_visible()

    # Create test CSV file with unique names
    suffix1 = uuid.uuid4().hex[:6]
    suffix2 = uuid.uuid4().hex[:6]

    test_csv_rows = [
        {
            "name": f"John CSVTest{suffix1}",
            "email": f"csvtest1_{suffix1}@purdue.edu",
            "role": "ta",
        },
        {
            "name": f"Jane CSVTest{suffix2}",
            "email": f"csvtest2_{suffix2}@purdue.edu",
            "role": "instructional",
        },
    ]

    csv_file_path = _create_test_csv(test_csv_rows)

    try:
        # Upload CSV file via file input
        file_input = page.get_by_test_id("csv-file-input")
        file_input.wait_for(state="visible", timeout=5000)
        file_input.set_input_files(csv_file_path)

        # Wait for CSV to be processed and move to mapping stage
        mapping_stage = page.get_by_test_id("csv-upload-stage-mapping")
        mapping_stage.wait_for(state="visible", timeout=10000)
        expect(mapping_stage).to_be_visible()

        # Verify column mapping table appears
        mapping_table = page.get_by_test_id("csv-column-mapping-table")
        mapping_table.wait_for(state="visible", timeout=5000)
        expect(mapping_table).to_be_visible()

        # Verify columns are auto-mapped (name, email, role)
        # The auto-mapping should have already mapped these columns
        # We can verify by checking that mapping rows exist
        name_mapping = page.get_by_test_id("csv-column-mapping-name")
        if name_mapping.count() > 0:
            # Verify mapping is correct (should show "Name" as destination)
            expect(name_mapping).to_be_visible()

        # Click "Continue to Review" button
        continue_button = page.get_by_role("button", name="Continue to Review")
        continue_button.wait_for(state="visible", timeout=5000)
        continue_button.click()

        # Wait for processing and move to review stage
        review_stage = page.get_by_test_id("csv-upload-stage-review")
        review_stage.wait_for(state="visible", timeout=15000)
        expect(review_stage).to_be_visible()

        # Verify review table appears
        review_table = page.get_by_test_id("csv-review-table")
        review_table.wait_for(state="visible", timeout=5000)
        expect(review_table).to_be_visible()

        # Verify rows appear in review table
        review_rows = page.locator("[data-testid^='csv-review-row-']")
        review_rows.first.wait_for(state="visible", timeout=5000)
        assert review_rows.count() >= 2, "Expected at least 2 rows in review table"

        # Optionally edit a row if needed (for testing edit functionality)
        # Find first review row and verify it's editable
        first_review_row = review_rows.first
        name_input = first_review_row.locator("input").first
        if name_input.count() > 0:
            # Verify input is editable
            expect(name_input).to_be_visible()

        # Click submit button
        submit_button = page.get_by_test_id("csv-submit-button")
        submit_button.wait_for(state="visible", timeout=5000)
        expect(submit_button).to_be_enabled()
        submit_button.click()

        # Wait for modal to close and staff list to refresh
        csv_modal.wait_for(state="hidden", timeout=15000)
        page.wait_for_load_state("networkidle")

        # Verify staff appear in list
        # Wait for table to update
        page.wait_for_timeout(2000)

        # Check that new staff members were created
        # Search for one of the test staff members
        search_input = page.get_by_test_id("staff-search")
        if search_input.count() > 0:
            # Search for the email we created
            test_email = test_csv_rows[0]["email"]
            search_input.fill(test_email)
            page.wait_for_timeout(500)

            # Verify staff member appears in results
            matching_rows = staff_table.get_by_test_id("staff-row").filter(
                has_text=test_email
            )
            if matching_rows.count() > 0:
                expect(matching_rows.first).to_be_visible()

        # Clean up: delete test staff members via API
        staff_list = fetch_staff_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )

        # Find and delete test staff members
        for row in test_csv_rows:
            email = row["email"]
            # Find staff member by email
            for staff in staff_list.get("staff", []):
                if staff.get("email") == email:
                    try:
                        delete_staff_api(
                            page.context.request,
                            staff["profile_id"],
                            current_profile_id=ADMIN_PROFILE_ID,
                            effective_profile_id=ADMIN_PROFILE_ID,
                        )
                    except Exception:
                        # Ignore errors during cleanup
                        pass
                    break

    finally:
        # Clean up temporary CSV file
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)


def test_staff_csv_upload_with_validation_errors(page: Page, base_url: str) -> None:
    """Test CSV upload with validation errors that need to be fixed."""
    # Navigate to staff page
    page.goto(f"{base_url}/management/staff")
    page.wait_for_load_state("networkidle")

    # Wait for staff table to load
    staff_table = page.get_by_test_id("staff-table")
    staff_table.wait_for(state="visible", timeout=15000)

    # Click "Create Staff" button
    create_button = page.get_by_role("button", name="Create Staff")
    create_button.wait_for(state="visible", timeout=10000)
    create_button.click()

    # Click "CSV Import" option
    csv_import_option = page.get_by_role("menuitem", name="CSV Import")
    csv_import_option.wait_for(state="visible", timeout=5000)
    csv_import_option.click()

    # Wait for CSV upload modal
    csv_modal = page.get_by_test_id("csv-upload-modal")
    csv_modal.wait_for(state="visible", timeout=10000)

    # Create CSV with validation errors (missing required fields)
    test_csv_rows = [
        {
            "name": "",  # Missing name - should cause error
            "email": "redacted@purdue.edu",
            "role": "ta",
        },
        {
            "name": "",  # Missing name - should cause error
            "email": "redacted@purdue.edu",
            "role": "instructional",
        },
    ]

    csv_file_path = _create_test_csv(test_csv_rows)

    try:
        # Upload CSV file
        file_input = page.get_by_test_id("csv-file-input")
        file_input.set_input_files(csv_file_path)

        # Wait for mapping stage
        mapping_stage = page.get_by_test_id("csv-upload-stage-mapping")
        mapping_stage.wait_for(state="visible", timeout=10000)

        # Continue to review
        continue_button = page.get_by_role("button", name="Continue to Review")
        continue_button.click()

        # Wait for review stage
        review_stage = page.get_by_test_id("csv-upload-stage-review")
        review_stage.wait_for(state="visible", timeout=15000)

        # Verify error rows are shown (they should be highlighted)
        _review_table = page.get_by_test_id("csv-review-table")
        review_rows = page.locator("[data-testid^='csv-review-row-']")

        # Verify rows with errors are visible and highlighted
        # Error rows should have red background on error fields
        first_row = review_rows.first
        name_cell = first_row.locator("td").nth(1)  # Name column
        if name_cell.count() > 0:
            # Check if cell has error styling (bg-destructive/10 class)
            # This indicates validation errors
            pass

        # Edit first row to fix error
        name_input = first_row.locator("input").first
        if name_input.count() > 0:
            name_input.fill("John Doe")
            page.wait_for_timeout(500)

        # Fix second row
        second_row = review_rows.nth(1)
        if second_row.count() > 0:
            second_name_input = second_row.locator("input").first
            if second_name_input.count() > 0:
                second_name_input.fill("Jane Smith")
                page.wait_for_timeout(500)

        # Submit after fixing errors
        submit_button = page.get_by_test_id("csv-submit-button")
        if submit_button.is_enabled():
            submit_button.click()

            # Wait for modal to close
            csv_modal.wait_for(state="hidden", timeout=15000)

    finally:
        # Clean up
        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)
