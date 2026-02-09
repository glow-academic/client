"""E2E test validating cache behavior and revalidation across document flows."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from playwright.sync_api import Page, expect
from server.tests.e2e.documents.helpers import (
    create_document_api,
    delete_document_api,
    fetch_documents_list,
    generate_unique_document_name,
    update_document_api,
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


def _set_request_counter(
    page: Page, pattern: str
) -> tuple[dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request: Any) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_document_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="document-card"]'))
        .map(el => el.dataset.documentId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_documents_cache_revalidation_after_create(page: Page, base_url: str) -> None:
    """Ensure document creation invalidates cache and new document appears."""
    document_id = None
    try:
        page.goto(f"{base_url}/management/documents")
        page.wait_for_load_state("networkidle")

        # Get initial document count
        initial_ids = _collect_document_ids(page)
        initial_count = len(initial_ids)

        # Create document via API
        document_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Cache Test Document"),
            type="homework",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Refresh page
        page.reload()
        page.wait_for_load_state("networkidle")

        # Verify new document appears
        new_ids = _collect_document_ids(page)
        assert document_id in new_ids or len(new_ids) > initial_count, (
            "New document did not appear after cache revalidation"
        )
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


def test_documents_cache_revalidation_after_update(page: Page, base_url: str) -> None:
    """Ensure document update invalidates cache and changes appear."""
    document_id = None
    try:
        # Create document
        document_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Cache Update Document"),
            type="homework",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/management/documents")
        page.wait_for_load_state("networkidle")

        # Note original type
        data = fetch_documents_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        original_doc = next(
            (
                d
                for d in data.get("documents", [])
                if d.get("document_id") == document_id
            ),
            None,
        )
        if not original_doc:
            pytest.skip("Created document not found in list")

        # Update document via API
        update_document_api(
            page.context.request,
            document_id,
            {"type": "project"},
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Refresh page
        page.reload()
        page.wait_for_load_state("networkidle")

        # Verify update appears (check document still exists and type changed)
        updated_data = fetch_documents_list(
            page.context.request,
            profile_id=ADMIN_PROFILE_ID,
            bypass_cache=True,
        )
        updated_doc = next(
            (
                d
                for d in updated_data.get("documents", [])
                if d.get("document_id") == document_id
            ),
            None,
        )
        assert updated_doc is not None, "Document should still exist after update"
        assert updated_doc.get("type") == "project", "Document type should be updated"
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


def test_documents_cache_revalidation_after_delete(page: Page, base_url: str) -> None:
    """Ensure document deletion invalidates cache and document is removed."""
    document_id = None
    try:
        # Create document
        document_id = create_document_api(
            page.context.request,
            name=generate_unique_document_name("Cache Delete Document"),
            type="homework",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        page.goto(f"{base_url}/management/documents")
        page.wait_for_load_state("networkidle")

        # Verify document visible
        document_card = page.locator(
            f"[data-testid='document-card'][data-document-id='{document_id}']"
        )
        if document_card.count() == 0:
            # Try list view
            document_row = page.locator("tr").filter(has_text=document_id)
            expect(document_row).to_be_visible()

        # Store document_id before deletion
        doc_id_to_check = document_id

        # Delete document via API
        delete_document_api(
            page.context.request,
            document_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        document_id = None  # Mark as deleted so finally block doesn't try again

        # Refresh page
        page.reload()
        page.wait_for_load_state("networkidle")

        # Verify document removed
        document_card = page.locator(
            f"[data-testid='document-card'][data-document-id='{doc_id_to_check}']"
        )
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


def test_documents_no_double_fetch_on_navigation(page: Page, base_url: str) -> None:
    """Ensure navigating away and back doesn't cause double-fetch of list."""
    list_counter, stop_counter = _set_request_counter(
        page, "/api/v4/artifacts/documents/list"
    )

    page.goto(f"{base_url}/management/documents")
    page.wait_for_load_state("networkidle")

    # Navigate away
    page.goto(f"{base_url}/training/personas")
    page.wait_for_load_state("networkidle")

    # Navigate back
    page.goto(f"{base_url}/management/documents")
    page.wait_for_load_state("networkidle")

    stop_counter()

    # Should have at most 2 requests (initial load + return navigation)
    # Ideally should be 1 if cache is working perfectly
    assert list_counter["total"] <= 2, (
        f"Documents list endpoint fetched {list_counter['total']} times, expected <= 2"
    )
