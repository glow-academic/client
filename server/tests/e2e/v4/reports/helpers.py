"""Shared helpers for reports E2E tests."""

from __future__ import annotations

import json
import os
from typing import Any

from playwright.sync_api import APIRequestContext, Page, expect

from server.tests.e2e.conftest import PROFILE_ID, _build_test_headers

API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")
print(f"[E2E] Using profile_id={PROFILE_ID} api_base={API_BASE}")
_PROFILE_RESOLUTION_CACHE: dict[tuple[str, str], tuple[str, str]] = {}


def _post_json(
    request: APIRequestContext,
    path: str,
    payload: dict[str, Any],
    *,
    profile_id: str,
    effective_profile_id: str | None,
    bypass_cache: bool,
) -> dict[str, Any]:
    effective_id = effective_profile_id or profile_id
    headers = {
        "Content-Type": "application/json",
        "X-Bypass-Cache": "1" if bypass_cache else "0",
        **_build_test_headers(profile_id, effective_id),
    }
    response = request.post(
        f"{API_BASE}{path}",
        headers=headers,
        data=json.dumps(payload),
    )
    if not response.ok:
        raise RuntimeError(
            f"Request to {path} failed with status {response.status}: {response.text()}"
        )
    return response.json()  # type: ignore[no-any-return]


def _resolve_profile_ids(
    request: APIRequestContext,
    *,
    profile_id: str,
    effective_profile_id: str | None,
    pathname: str = "/analytics/reports",
) -> tuple[str, str]:
    """Resolve profile IDs to ensure they are valid UUIDs."""
    effective = effective_profile_id or profile_id
    cache_key = (profile_id, effective)
    if cache_key in _PROFILE_RESOLUTION_CACHE:
        return _PROFILE_RESOLUTION_CACHE[cache_key]

    data = _post_json(
        request,
        "/api/v4/profile/context",
        {
            "actualProfileId": profile_id,
            "effectiveProfileId": effective,
            "pathname": pathname,
        },
        profile_id=profile_id,
        effective_profile_id=effective,
        bypass_cache=True,
    )
    resolved_actual = data["actualProfile"]["id"]
    resolved_effective = data["effectiveProfile"]["id"]
    print(
        f"[E2E] Resolved profile ids for ({profile_id}, {effective}) -> ({resolved_actual}, {resolved_effective})"
    )
    _PROFILE_RESOLUTION_CACHE[cache_key] = (resolved_actual, resolved_effective)
    return resolved_actual, resolved_effective


def fetch_reports_data(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    filters: dict[str, Any] | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch reports data via API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )

    # Build default filters if not provided
    if filters is None:
        # Get profile context to determine default date range
        profile_context = _post_json(
            request,
            "/api/v4/profile/context",
            {
                "actualProfileId": resolved_actual,
                "effectiveProfileId": resolved_effective,
                "pathname": "/analytics/reports",
            },
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
            bypass_cache=True,
        )

        from datetime import datetime, timedelta

        earliest_date = profile_context.get("earliestAttemptDate")
        if earliest_date:
            start_date = datetime.fromisoformat(earliest_date.replace("Z", "+00:00"))
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = datetime.now() - timedelta(days=30)
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

        end_date = datetime.now()
        end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999000)

        filters = {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "cohortIds": [],
            "roles": [],
            "simulationFilters": ["general"],
            "departmentIds": [],
        }

    return _post_json(
        request,
        "/api/v4/reports",
        filters,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def wait_for_reports_load(page: Page) -> None:
    """Wait for reports page to fully load with data."""
    page.wait_for_load_state("networkidle")
    container = page.get_by_test_id("reports-container")
    container.wait_for(state="visible", timeout=15000)
    expect(container).to_be_visible()


def verify_reports_ssr(page: Page) -> None:
    """Verify reports page SSR rendering."""
    # Verify data-page attribute
    page_container = page.locator('[data-page="reports-index"]')
    expect(page_container).to_be_visible()

    # Verify main container
    container = page.get_by_test_id("reports-container")
    expect(container).to_be_visible()

    # Verify table container
    table_container = page.get_by_test_id("reports-table-container")
    expect(table_container).to_be_visible()
