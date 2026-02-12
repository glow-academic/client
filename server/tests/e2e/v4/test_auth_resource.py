"""E2E skeleton: Auth resource artifact lifecycle (/system/auth)."""

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


def test_auth_resource_lifecycle(page: Page, base_url: str) -> None:
    """Full CRUD lifecycle for auth resources (/system/auth)."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    request = page.context.request

    try:
        # Step 1: Fetch /new defaults via API
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )
        defaults = post_json(
            request,
            "/api/v4/artifacts/auth/new",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert defaults is not None

        # Step 2: Create via API → get ID
        # Step 3: Navigate to detail page → verify fields rendered
        # Step 4: Navigate to list page → verify card/row visible
        # Step 5: Search → verify filters to our item
        # Step 6: Edit → update a field, submit, verify change
        # Step 7: Duplicate → verify copy appears
        # Step 8: Delete duplicate → confirm dialog → verify gone
        # Step 9: Delete original → confirm dialog → verify gone

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v4/artifacts/auth/delete",
                    {"authId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
