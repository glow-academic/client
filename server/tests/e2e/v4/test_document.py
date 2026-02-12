"""E2E skeleton: Document artifact lifecycle (/management/documents).

Uses existing docs from seed data (list → pick first editable) instead of TUS upload.
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import (
    ADMIN_PROFILE_ID,
    generate_unique_name,
    post_json,
    resolve_profile_ids,
)

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_document_lifecycle(page: Page, base_url: str) -> None:
    """Lifecycle using existing documents: list → detail → search → edit → verify."""
    pytest.skip("Skeleton — not yet implemented")

    request = page.context.request

    try:
        # Step 1: Navigate to list page → verify grid renders
        page.goto(f"{base_url}/management/documents")
        page.wait_for_load_state("networkidle")
        grid = page.get_by_test_id("documents-grid")
        grid.wait_for(state="visible", timeout=15000)
        expect(grid).to_be_visible()

        # Step 2: Verify cards visible
        cards = grid.get_by_test_id("document-card")
        if cards.count() == 0:
            pytest.skip("No documents available in seed data")
        initial_count = cards.count()

        # Step 3: Search → verify filters work
        first_card = cards.first
        doc_name = first_card.inner_text().splitlines()[0].strip()
        search_input = page.get_by_test_id("documents-search")
        search_input.fill(doc_name[:10])
        page.wait_for_timeout(250)
        filtered_count = cards.count()
        assert filtered_count <= initial_count

        # Step 4: Clear search
        search_input.fill("")
        page.wait_for_timeout(250)

        # Step 5: Click first editable document → navigate to detail
        first_card.click()
        page.wait_for_load_state("networkidle")

        # Step 6: Verify detail page renders
        # Step 7: Edit a field → submit → verify change

        # Step 8: Navigate back to list
        page.goto(f"{base_url}/management/documents")
        page.wait_for_load_state("networkidle")
        expect(grid).to_be_visible()

    finally:
        pass
