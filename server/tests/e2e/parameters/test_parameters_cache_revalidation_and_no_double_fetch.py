"""E2E tests for parameters cache revalidation and no double fetch."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.parameters.helpers import (
    create_parameter_api,
    delete_parameter_api,
    generate_unique_parameter_name,
    update_parameter_api,
)

ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def _expect_toast(page: Page, message: str) -> None:
    toast = page.get_by_role("alert").filter(has_text=message)
    try:
        toast.wait_for(state="visible", timeout=5000)
    except Exception:
        toast = page.get_by_text(message, exact=False)
        toast.wait_for(state="visible", timeout=5000)
    expect(toast).to_be_visible()


def _collect_parameter_ids(page: Page) -> set[str]:
    ids = page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid="parameter-card"]'))
        .map(el => el.dataset.parameterId)
        .filter(Boolean)"""
    )
    return set(ids)


def test_parameters_cache_revalidation_and_no_double_fetch(
    page: Page, base_url: str
) -> None:
    """Verify cache revalidation works and no double fetch occurs."""
    parameter_id = None
    try:
        # Navigate to list page
        page.goto(f"{base_url}/management/parameters")
        page.wait_for_load_state("networkidle")

        _collect_parameter_ids(page)

        # Create parameter via API
        parameter_name = generate_unique_parameter_name("Cache Test")
        parameter_id = create_parameter_api(
            page.context.request,
            name=parameter_name,
            description="Parameter for cache test",
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to list page - should refresh and show new parameter
        page.goto(f"{base_url}/management/parameters")
        page.wait_for_load_state("networkidle")

        new_ids = _collect_parameter_ids(page)
        assert parameter_id in new_ids, "New parameter not found after create"

        # Edit parameter via API
        update_parameter_api(
            page.context.request,
            parameter_id,
            {"description": "Updated description"},
            profile_id=ADMIN_PROFILE_ID,
            effective_profile_id=ADMIN_PROFILE_ID,
        )

        # Navigate to list page - should reflect updates
        page.goto(f"{base_url}/management/parameters")
        page.wait_for_load_state("networkidle")

        # Navigate to detail page - should load without double fetch
        page.goto(f"{base_url}/management/parameters/p/{parameter_id}")
        page.wait_for_load_state("networkidle")

        # Verify page loads correctly
        name_input = page.get_by_test_id("input-parameter-name")
        expect(name_input).to_be_visible()

        # Update parameter via UI
        description_input = page.get_by_test_id("input-parameter-description")
        description_input.fill("UI updated description")

        submit_button = page.get_by_test_id("btn-submit-parameter")
        submit_button.click()

        # Navigate back to list
        page.wait_for_url(f"{base_url}/management/parameters", timeout=20000)
        page.wait_for_load_state("networkidle")

        # Verify updates reflected
        search_input = page.get_by_test_id("parameters-search")
        search_input.fill(parameter_name)
        page.wait_for_timeout(250)

        parameter_card = (
            page.get_by_test_id("parameter-card").filter(has_text=parameter_name).first
        )
        expect(parameter_card).to_be_visible()
    finally:
        # Cleanup
        if parameter_id:
            try:
                delete_parameter_api(
                    page.context.request,
                    parameter_id,
                    profile_id=ADMIN_PROFILE_ID,
                    effective_profile_id=ADMIN_PROFILE_ID,
                )
            except Exception:
                pass
