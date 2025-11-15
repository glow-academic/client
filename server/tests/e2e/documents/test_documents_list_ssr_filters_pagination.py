"""E2E tests for documents list SSR, search, filters, and pagination."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.documents.helpers import (
    create_document_api,
    delete_document_api,
    fetch_documents_list,
    generate_unique_document_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_documents_list_filters_and_empty_state(page: Page, base_url: str) -> None:
    """Ensure document list SSR renders and search/filter flows work."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Check for either list or grid view
    list_view = page.get_by_test_id("documents-list")
    grid_view = page.get_by_test_id("documents-grid")

    if list_view.count() > 0:
        list_view.wait_for(state="visible", timeout=15000)
        expect(list_view).to_be_visible()
        cards_or_rows = page.locator("tbody tr, [data-testid='document-card']")
    elif grid_view.count() > 0:
        grid_view.wait_for(state="visible", timeout=15000)
        expect(grid_view).to_be_visible()
        cards_or_rows = page.get_by_test_id("document-card")
    else:
        pytest.fail("Neither documents-list nor documents-grid found")

    initial_count = cards_or_rows.count()
    assert initial_count > 0, "No documents found on page"

    # Get first document name for search test
    first_item = cards_or_rows.first
    document_name = first_item.inner_text().splitlines()[0].strip()
    if not document_name:
        # Try getting name from aria-label or data attribute
        document_name = (
            (first_item.get_attribute("aria-label") or "Test Document")
            .replace("document card ", "")
            .strip()
        )

    search_input = page.get_by_test_id("documents-search")
    search_input.wait_for(state="visible", timeout=10000)
    search_input.fill(document_name)
    page.wait_for_timeout(250)
    filtered_count = cards_or_rows.count()
    assert filtered_count <= initial_count
    assert filtered_count > 0, "Search should return at least one result"

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards_or_rows.count() == initial_count

    toolbar = page.get_by_test_id("documents-toolbar")
    expect(toolbar).to_be_visible()

    # Test Type filter
    type_button = toolbar.get_by_role("button", name="Type")
    if type_button.count() > 0:
        type_button.click()
        type_options = page.get_by_role("option")
        if type_options.count() > 1:
            option = type_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards_or_rows.count() > 0
            type_button.click()
            clear_option = page.get_by_role("option").filter(has_text="Clear filters")
            if clear_option.count():
                clear_option.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards_or_rows.count() == initial_count
        else:
            type_button.click()

    # Test Scenario filter
    scenario_button = toolbar.get_by_role("button", name="Scenarios")
    if scenario_button.count() > 0:
        scenario_button.click()
        scenario_options = page.get_by_role("option")
        if scenario_options.count() > 1:
            option = scenario_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards_or_rows.count() > 0
            scenario_button.click()
            clear_option = page.get_by_role("option").filter(has_text="Clear filters")
            if clear_option.count():
                clear_option.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards_or_rows.count() == initial_count
        else:
            scenario_button.click()

    # Test Department filter
    dept_button = toolbar.get_by_role("button", name="Department")
    if dept_button.count() > 0:
        dept_button.click()
        dept_options = page.get_by_role("option")
        if dept_options.count() > 1:
            option = dept_options.nth(1)
            option.click()
            page.wait_for_timeout(250)
            assert cards_or_rows.count() > 0
            dept_button.click()
            clear_option = page.get_by_role("option").filter(has_text="Clear filters")
            if clear_option.count():
                clear_option.first.click(force=True)
            else:
                page.get_by_role("option").nth(0).click()
            page.wait_for_timeout(250)
            assert cards_or_rows.count() == initial_count
        else:
            dept_button.click()

    # Test empty state
    search_input.fill("zzzz-no-match-zzzz")
    page.wait_for_timeout(250)
    expect(cards_or_rows).to_have_count(0)
    expect(page.get_by_text("No documents match the current filters.")).to_be_visible()

    search_input.fill("")
    page.wait_for_timeout(250)
    assert cards_or_rows.count() == initial_count


def test_documents_pagination_persists_filters(page: Page, base_url: str) -> None:
    """Verify pagination works with filters applied."""
    created_document_ids: list[str] = []
    try:
        data = fetch_documents_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
        )
        documents = data.get("documents", [])
        if len(documents) <= 10:
            needed = 13 - len(documents)
            for _ in range(needed):
                document_id = create_document_api(
                    page.context.request,
                    name=generate_unique_document_name("Pagination Document"),
                    type="homework",
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
                created_document_ids.append(document_id)
            page.goto(f"{base_url}/create/documents")
            page.wait_for_load_state("networkidle")

        page.goto(f"{base_url}/create/documents")
        page.wait_for_load_state("networkidle")

        # Apply a filter
        toolbar = page.get_by_test_id("documents-toolbar")
        type_button = toolbar.get_by_role("button", name="Type")
        if type_button.count() > 0:
            type_button.click()
            type_options = page.get_by_role("option")
            if type_options.count() > 1:
                type_options.nth(1).click()
                page.wait_for_timeout(250)

        next_button = page.get_by_role("button", name="Go to next page")
        if next_button.is_disabled():
            pytest.skip("Pagination controls unavailable")
        next_button.click()
        page.wait_for_timeout(250)

        page.reload()
        page.wait_for_load_state("networkidle")
        pagination_label = page.get_by_text("Page 2 of")
        expect(pagination_label).to_be_visible()

        prev_button = page.get_by_role("button", name="Go to previous page")
        prev_button.click()
        page.wait_for_timeout(250)
        expect(page.get_by_text("Page 1 of")).to_be_visible()
    finally:
        for document_id in created_document_ids:
            try:
                delete_document_api(
                    page.context.request,
                    document_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_documents_view_mode_switching(page: Page, base_url: str) -> None:
    """Verify view mode switching between list and grid works."""
    page.goto(f"{base_url}/create/documents")
    page.wait_for_load_state("networkidle")

    # Verify default is list view
    list_view = page.get_by_test_id("documents-list")
    if list_view.count() > 0:
        expect(list_view).to_be_visible()

    # Find view mode toggle buttons
    toolbar = page.get_by_test_id("documents-toolbar")
    list_button = toolbar.get_by_role("button").filter(
        has_text=re.compile("List", re.I)
    )
    grid_button = toolbar.get_by_role("button").filter(
        has_text=re.compile("Grid", re.I)
    )

    if list_button.count() == 0 or grid_button.count() == 0:
        # Try finding by icon
        list_button = toolbar.locator("button").filter(has=page.locator("svg")).first
        grid_button = toolbar.locator("button").filter(has=page.locator("svg")).nth(1)

    if list_button.count() > 0 and grid_button.count() > 0:
        # Switch to grid view
        grid_button.click()
        page.wait_for_timeout(250)
        grid_view = page.get_by_test_id("documents-grid")
        expect(grid_view).to_be_visible()

        # Switch back to list view
        list_button.click()
        page.wait_for_timeout(250)
        list_view = page.get_by_test_id("documents-list")
        expect(list_view).to_be_visible()
