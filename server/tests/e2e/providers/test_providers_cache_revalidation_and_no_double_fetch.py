"""E2E test validating cache behavior and revalidation across provider/model flows."""

from __future__ import annotations

from collections.abc import Callable

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.providers.helpers import (
    create_model_api,
    create_provider_api,
    delete_model_api,
    delete_provider_api,
    generate_unique_model_name,
    generate_unique_provider_name,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _set_request_counter(
    page: Page, pattern: str
) -> tuple[dict[str, int], Callable[[], None]]:
    counts = {"total": 0}

    def _handle(request) -> None:
        if pattern in request.url:
            counts["total"] += 1

    page.on("request", _handle)

    def stop() -> None:
        page.remove_listener("request", _handle)

    return counts, stop


def _collect_provider_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="provider-card"]'))
        .map(el => el.dataset.providerId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_providers_list_cache_revalidation_on_create(page: Page, base_url: str) -> None:
    """Verify providers list cache revalidates when provider is created via API."""
    provider_id = None

    try:
        # Create provider via API
        provider_id = create_provider_api(
            page.context.request,
            name=generate_unique_provider_name("Cache Revalidation Provider"),
            description="Provider created for cache revalidation test.",
            api_key="test-api-key-cache-reval",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to providers list
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Verify new provider appears (cache was revalidated)
        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(provider_card).to_be_visible()

    finally:
        # Cleanup
        if provider_id:
            try:
                delete_provider_api(
                    page.context.request,
                    provider_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_providers_list_cache_revalidation_on_update(page: Page, base_url: str) -> None:
    """Verify providers list cache revalidates when provider is updated via API."""
    provider_id = None

    try:
        # Create provider via API
        provider_id = create_provider_api(
            page.context.request,
            name=generate_unique_provider_name("Update Cache Provider"),
            description="Original description.",
            api_key="test-api-key-update-cache",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to list and verify initial state
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(provider_card).to_be_visible()

        # Update provider via API
        from server.tests.e2e.providers.helpers import update_provider_api

        updated_name = f"{generate_unique_provider_name('Updated Cache Provider')}"
        update_provider_api(
            page.context.request,
            provider_id,
            name=updated_name,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Refresh page to see updated data
        page.reload()
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Search for updated name
        search_input = page.get_by_test_id("providers-search")
        search_input.wait_for(state="visible", timeout=10000)
        search_input.fill(updated_name)
        page.wait_for_timeout(500)

        updated_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(updated_card).to_be_visible()

    finally:
        # Cleanup
        if provider_id:
            try:
                delete_provider_api(
                    page.context.request,
                    provider_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_providers_list_cache_revalidation_on_delete(page: Page, base_url: str) -> None:
    """Verify providers list cache revalidates when provider is deleted via API."""
    provider_id = None

    try:
        # Create provider via API
        provider_id = create_provider_api(
            page.context.request,
            name=generate_unique_provider_name("Delete Cache Provider"),
            description="Provider created for delete cache test.",
            api_key="test-api-key-delete-cache",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to list and verify provider exists
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        provider_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{provider_id}']"
        )
        expect(provider_card).to_be_visible()

        # Delete provider via API
        deleted_provider_id = provider_id
        delete_provider_api(
            page.context.request,
            provider_id,
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )
        provider_id = None  # Mark as deleted

        # Refresh page
        page.reload()
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Verify provider is removed
        deleted_card = page.locator(
            f"[data-testid='provider-card'][data-provider-id='{deleted_provider_id}']"
        )
        expect(deleted_card).to_have_count(0)

    finally:
        # Cleanup (provider should already be deleted)
        if provider_id:
            try:
                delete_provider_api(
                    page.context.request,
                    provider_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass


def test_no_double_fetch_on_navigation(page: Page, base_url: str) -> None:
    """Verify no duplicate API requests when navigating away and back."""
    list_counter, stop_counter = _set_request_counter(page, "/api/v3/providers/list")

    # First navigation
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)

    initial_count = list_counter["total"]

    # Navigate away
    page.goto(f"{base_url}/create/personas")
    page.wait_for_load_state("networkidle")

    # Navigate back
    page.goto(f"{base_url}/system/providers")
    page.wait_for_load_state("networkidle")

    grid = page.get_by_test_id("providers-grid")
    grid.wait_for(state="visible", timeout=15000)

    stop_counter()

    # Should have at most 2 requests (initial + return navigation)
    # Cache should prevent duplicate fetches
    assert list_counter["total"] <= initial_count + 1, (
        f"Providers list endpoint fetched {list_counter['total']} times, expected <= {initial_count + 1}"
    )


def test_model_cache_revalidation_on_create(page: Page, base_url: str) -> None:
    """Verify model appears in list after creation via API."""
    provider_id = None
    model_id = None

    try:
        # Create provider and model via API
        provider_id = create_provider_api(
            page.context.request,
            name=generate_unique_provider_name("Model Cache Provider"),
            description="Provider for model cache test.",
            api_key="test-api-key-model-cache",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        model_id = create_model_api(
            page.context.request,
            provider_id=provider_id,
            name=generate_unique_model_name("Cache Model"),
            description="Model created for cache revalidation test.",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to providers list
        page.goto(f"{base_url}/system/providers")
        page.wait_for_load_state("networkidle")

        grid = page.get_by_test_id("providers-grid")
        grid.wait_for(state="visible", timeout=15000)

        # Verify model appears
        model_card = page.locator(
            f"[data-testid='model-card'][data-model-id='{model_id}']"
        )
        expect(model_card).to_be_visible()

    finally:
        # Cleanup
        if model_id:
            try:
                delete_model_api(
                    page.context.request,
                    model_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
        if provider_id:
            try:
                delete_provider_api(
                    page.context.request,
                    provider_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
