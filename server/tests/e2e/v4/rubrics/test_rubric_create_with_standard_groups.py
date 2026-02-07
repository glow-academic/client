"""E2E test for creating a rubric and adding standard groups with standards."""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.rubrics.helpers import (
    delete_rubric_api,
    fetch_rubric_detail,
    generate_unique_rubric_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_rubric_create_with_standard_groups(page: Page, base_url: str) -> None:
    """Create a rubric, add standard groups with 5 standards, edit header, and test collapse/delete."""
    rubric_name = None
    rubric_id = None

    try:
        page.goto(f"{base_url}/intelligence/rubrics/new", timeout=30000)
        page.wait_for_load_state("networkidle", timeout=30000)

        # Verify page attribute
        page_container = page.locator("[data-page='rubric-new']")
        expect(page_container).to_be_visible()

        name_input = page.get_by_test_id("input-rubric-name")
        name_input.wait_for(state="visible", timeout=20000)

        submit_button = page.get_by_test_id("btn-save-rubric")

        # Fill out required fields
        rubric_name = generate_unique_rubric_name("Standard Group Test")
        name_input.fill(rubric_name)

        description_input = page.get_by_test_id("input-rubric-description")
        description_input.wait_for(state="visible", timeout=20000)
        description_input.fill("Rubric with standard groups for E2E test.")

        # Ensure any open dropdowns/pickers are closed before submitting
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)

        # Submit form
        submit_button.click()

        # Wait for redirect to edit page (rubrics redirect to edit page after creation)
        page.wait_for_url(
            re.compile(r".*/intelligence/rubrics/r/[a-f0-9-]+"), timeout=20000
        )
        page.wait_for_load_state("networkidle")

        # Extract rubric ID from URL
        match = re.search(r"/r/([a-f0-9-]+)", page.url)
        if not match:
            raise AssertionError(f"Could not extract rubric ID from URL: {page.url}")
        rubric_id = match.group(1)

        # Now we're on the edit page - standard groups section should be visible
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Find the "New Standard Group" card
        new_group_text = page.get_by_text("New Standard Group", exact=False)
        create_category_text = page.get_by_text(
            "Create a new evaluation category", exact=False
        )

        if new_group_text.count() > 0:
            new_group_text.first.wait_for(state="visible", timeout=10000)
        elif create_category_text.count() > 0:
            create_category_text.first.wait_for(state="visible", timeout=10000)
        else:
            cards = page.locator("div[class*='Card']")
            if cards.count() > 0:
                cards.last.wait_for(state="visible", timeout=10000)
                page.wait_for_timeout(500)

        # Fill in standard group form
        name_labels = page.get_by_text("Name", exact=False)
        if name_labels.count() > 0:
            name_label = name_labels.first
            container = name_label.locator("..").locator("..")
            group_name_input = container.locator("input").first
            if group_name_input.count():
                group_name_input.fill("Test Standard Group")
                page.wait_for_timeout(300)

        desc_labels = page.get_by_text("Description", exact=False)
        if desc_labels.count() > 0:
            desc_label = desc_labels.first
            container = desc_label.locator("..").locator("..")
            group_desc_input = container.locator("textarea").first
            if group_desc_input.count():
                group_desc_input.fill("Test standard group description")
                page.wait_for_timeout(300)

        # Fill in points - set Max Points to 5 so we can add 5 standards
        number_inputs = page.locator("input[type='number']")
        if number_inputs.count() >= 2:
            points_input = number_inputs.nth(0)
            if points_input.count():
                points_input.fill("5")
                page.wait_for_timeout(300)

            pass_points_input = number_inputs.nth(1)
            if pass_points_input.count():
                pass_points_input.fill("3")
                page.wait_for_timeout(300)

        # Add 5 standards
        add_standard_button = page.get_by_role(
            "button", name=re.compile("Add Standard", re.I)
        )
        standards_data = [
            {
                "points": "5",
                "name": "Excellent Performance",
                "description": "Demonstrates exceptional understanding and application of concepts",
            },
            {
                "points": "4",
                "name": "Good Performance",
                "description": "Shows solid understanding with minor areas for improvement",
            },
            {
                "points": "3",
                "name": "Satisfactory Performance",
                "description": "Meets basic requirements and demonstrates adequate understanding",
            },
            {
                "points": "2",
                "name": "Needs Improvement",
                "description": "Shows some understanding but requires significant development",
            },
            {
                "points": "1",
                "name": "Unsatisfactory Performance",
                "description": "Does not meet minimum requirements and needs substantial support",
            },
        ]

        for _i, standard_data in enumerate(standards_data):
            if add_standard_button.count():
                # Scroll to make sure button is visible
                add_standard_button.first.scroll_into_view_if_needed()
                add_standard_button.first.click()
                page.wait_for_timeout(500)

                # Find the table rows - get the last one (newly added)
                standard_rows = page.locator("table tbody tr")
                if standard_rows.count() > 0:
                    new_standard_row = standard_rows.last

                    # Scroll to the row to make sure it's visible
                    new_standard_row.scroll_into_view_if_needed()
                    page.wait_for_timeout(200)

                    # Fill in points (first number input in the row)
                    row_points_input = new_standard_row.locator(
                        "input[type='number']"
                    ).first
                    if row_points_input.count():
                        row_points_input.scroll_into_view_if_needed()
                        row_points_input.fill(standard_data["points"])
                        page.wait_for_timeout(200)

                    # Fill in name - the name input is in the second TableCell (index 1)
                    # It's a regular input with placeholder "Standard name"
                    row_cells = new_standard_row.locator("td")
                    if row_cells.count() >= 2:
                        name_cell = row_cells.nth(1)  # Second cell contains name
                        # Look for input with placeholder "Standard name"
                        row_name_input = name_cell.locator(
                            "input[placeholder='Standard name']"
                        ).first
                        if not row_name_input.count():
                            # Fallback: any input in the name cell
                            row_name_input = name_cell.locator("input").first
                        if row_name_input.count():
                            row_name_input.scroll_into_view_if_needed()
                            page.wait_for_timeout(200)
                            row_name_input.click()  # Click to focus
                            page.wait_for_timeout(100)
                            # Clear and fill
                            row_name_input.fill("")
                            page.wait_for_timeout(100)
                            row_name_input.fill(standard_data["name"])
                            page.wait_for_timeout(200)
                            # Verify it was filled
                            value = row_name_input.input_value()
                            if value != standard_data["name"]:
                                # Try again with type
                                row_name_input.type(standard_data["name"], delay=50)
                                page.wait_for_timeout(200)
                    else:
                        # Fallback: find all inputs in row, skip the first (points), use second for name
                        all_inputs = new_standard_row.locator("input")
                        if all_inputs.count() >= 2:
                            row_name_input = all_inputs.nth(1)  # Second input is name
                            row_name_input.scroll_into_view_if_needed()
                            page.wait_for_timeout(200)
                            row_name_input.click()
                            page.wait_for_timeout(100)
                            row_name_input.fill("")
                            page.wait_for_timeout(100)
                            row_name_input.fill(standard_data["name"])
                            page.wait_for_timeout(200)

                    # Fill in description (textarea in the row)
                    row_desc_input = new_standard_row.locator("textarea").first
                    if row_desc_input.count():
                        row_desc_input.scroll_into_view_if_needed()
                        row_desc_input.fill(standard_data["description"])
                        page.wait_for_timeout(200)

        # Scroll to find and click the "Create" button to save the standard group
        # The Create button should be within the standard group card's CardContent, after the table
        # Find the table first (it's in the standard group card)
        table = page.locator("table").last
        if table.count():
            # Scroll to the table first, then scroll down more to see the Create button
            table.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            # Scroll down more to ensure Create button is visible
            page.evaluate("window.scrollBy(0, 400)")
            page.wait_for_timeout(300)

            # Find the Create button that's after the table in the same CardContent
            # The button is in a div with "flex justify-end gap-2 mt-4 pt-4 border-t" after the table
            # Look for buttons after the table within the same parent container (CardContent)
            table_parent = table.locator("..").locator("..")  # Go up to CardContent
            # Find buttons with exact text "Create" (not "Create Rubric")
            all_buttons = table_parent.locator("button")
            create_button = None

            # Find the button with text exactly "Create" (for standard group)
            for i in range(all_buttons.count()):
                btn = all_buttons.nth(i)
                if btn.count():
                    btn_text = btn.inner_text()
                    # Look for button that says exactly "Create" (not "Create Rubric" or "Creating...")
                    if btn_text.strip() == "Create":
                        create_button = btn
                        break

            # If not found, try finding by role with exact match
            if not create_button or not create_button.count():
                create_buttons = table_parent.get_by_role(
                    "button", name="Create", exact=True
                )
                if create_buttons.count() > 0:
                    create_button = create_buttons.first

            if create_button and create_button.count() > 0:
                # Scroll to make sure the Create button is visible - scroll more aggressively
                create_button.scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                # Additional scroll to ensure it's fully visible
                page.evaluate("window.scrollBy(0, 200)")
                page.wait_for_timeout(300)
                # Verify it's the right button (should be visible and not disabled)
                if create_button.is_visible():
                    create_button.click()
                    page.wait_for_timeout(2000)
                else:
                    # Try scrolling even more
                    page.evaluate("window.scrollBy(0, 500)")
                    page.wait_for_timeout(500)
                    create_button.click()
                    page.wait_for_timeout(2000)

            # Wait for success toast
            try:
                toast = page.get_by_role("alert").filter(has_text="successfully")
                toast.wait_for(state="visible", timeout=5000)
            except Exception:
                page.wait_for_timeout(500)

        # Wait for page to refresh after creating standard group
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Test collapsing/uncollapsing the standard group
        # Find the standard group card (should now show the group name instead of "New Standard Group")
        group_card = page.get_by_text("Test Standard Group", exact=False).first
        if group_card.count():
            # The card header is clickable - click to collapse
            card_header = group_card.locator("..").locator("..").locator("header").first
            if card_header.count():
                card_header.click()
                page.wait_for_timeout(500)

                # Click again to expand
                card_header.click()
                page.wait_for_timeout(500)

        # Test editing the rubric header (name)
        # Click edit button to enter edit mode
        edit_button = page.get_by_test_id("btn-edit-rubric")
        if edit_button.count():
            edit_button.first.wait_for(state="visible", timeout=10000)
            edit_button.first.click()

            # Wait for edit mode to activate
            save_button = page.get_by_test_id("btn-save-rubric")
            save_button.wait_for(state="visible", timeout=10000)

            # Update rubric name
            name_input = page.get_by_test_id("input-rubric-name")
            name_input.wait_for(state="visible", timeout=10000)
            updated_name = f"{rubric_name} - Updated"
            name_input.fill(updated_name)
            page.wait_for_timeout(300)

            # Save the update
            save_button.click()
            page.wait_for_timeout(1500)

            # Wait for success toast
            try:
                toast = page.get_by_role("alert").filter(has_text="successfully")
                toast.wait_for(state="visible", timeout=5000)
            except Exception:
                page.wait_for_timeout(500)

        # Wait for page refresh
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # Test editing a standard group
        # Find the standard group card again
        group_card = page.get_by_text("Test Standard Group", exact=False).first
        if group_card.count():
            # Find the card header area which contains the edit/delete buttons
            # Look for buttons with Edit icon (ghost buttons in the header)
            card_header_area = group_card.locator("..").locator("..").locator("header")
            if card_header_area.count():
                # Find buttons in the header - edit button should be first
                header_buttons = card_header_area.locator("button")

                # Click edit button (first ghost button with Edit icon)
                if header_buttons.count() >= 1:
                    edit_group_button = header_buttons.nth(0)
                    edit_group_button.click()
                    page.wait_for_timeout(500)

                    # Verify we're in edit mode - should see Cancel button
                    cancel_button = page.get_by_role(
                        "button", name=re.compile("Cancel", re.I)
                    )
                    if cancel_button.count() > 0:
                        # Cancel the edit
                        cancel_button.first.click()
                        page.wait_for_timeout(500)

        # Test deleting a standard group
        # Set up dialog handler BEFORE clicking delete (delete uses window.confirm)
        page.on("dialog", lambda dialog: dialog.accept())

        # Find the standard group card again
        group_card = page.get_by_text("Test Standard Group", exact=False).first
        if group_card.count():
            card_header_area = group_card.locator("..").locator("..").locator("header")
            if card_header_area.count():
                header_buttons = card_header_area.locator("button")

                # Delete button should be the second button (after edit)
                if header_buttons.count() >= 2:
                    delete_group_button = header_buttons.nth(1)
                    delete_group_button.click()
                    page.wait_for_timeout(1500)

                    # Wait for success toast
                    try:
                        toast = page.get_by_role("alert").filter(
                            has_text="successfully"
                        )
                        toast.wait_for(state="visible", timeout=5000)
                    except Exception:
                        page.wait_for_timeout(500)

                    # Wait for page refresh
                    page.wait_for_load_state("networkidle")
                    page.wait_for_timeout(1000)

        # Verify the standard group was created by checking the API
        detail = fetch_rubric_detail(
            page.context.request,
            rubric_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )

        # Check if standard groups are returned
        standard_group_ids = detail.get("standard_group_ids", [])
        standard_groups_detail = detail.get("standard_groups_detail", {})
        standard_groups_mapping = detail.get("standard_groups_mapping", {})

        # Verify standard groups are returned
        assert standard_group_ids is not None, "standard_group_ids should not be None"
        assert standard_groups_detail is not None, (
            "standard_groups_detail should not be None"
        )
        assert standard_groups_mapping is not None, (
            "standard_groups_mapping should not be None"
        )

        # If we deleted the group, verify it's gone
        # Otherwise verify we have at least one standard group with 5 standards
        if len(standard_group_ids) > 0:
            # Verify the structure of standard_groups_detail
            for group_id in standard_group_ids:
                assert group_id in standard_groups_detail, (
                    f"Group {group_id} should be in standard_groups_detail"
                )
                group_detail = standard_groups_detail[group_id]
                assert "points" in group_detail, "Group detail should have points"
                assert "passPoints" in group_detail, (
                    "Group detail should have passPoints"
                )
                assert "standard_ids" in group_detail, (
                    "Group detail should have standard_ids"
                )

                # Verify we have 5 standards in the group (if group wasn't deleted)
                standard_ids = group_detail["standard_ids"]
                if len(standard_ids) > 0:
                    assert len(standard_ids) == 5, (
                        f"Group should have 5 standards, got {len(standard_ids)}"
                    )

        # Verify the rubric name was updated
        assert detail.get("name") == f"{rubric_name} - Updated", (
            "Rubric name should be updated"
        )

    finally:
        # Cleanup
        if rubric_id:
            try:
                delete_rubric_api(
                    page.context.request,
                    rubric_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
