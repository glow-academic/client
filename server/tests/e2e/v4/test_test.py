"""E2E skeleton: Benchmark test artifact lifecycle (create, get, list, archive)."""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect

from server.tests.e2e.v4.conftest import ADMIN_PROFILE_ID, post_json, resolve_profile_ids

pytestmark = [pytest.mark.e2e, pytest.mark.test_profile_id(ADMIN_PROFILE_ID)]


def test_benchmark_test_lifecycle(page: Page, base_url: str) -> None:
    """Benchmark test lifecycle: list tests → view detail → create test → archive."""
    pytest.skip("Skeleton — not yet implemented")

    created_ids: list[str] = []
    request = page.context.request

    try:
        resolved_actual, resolved_effective = resolve_profile_ids(
            request, profile_id=ADMIN_PROFILE_ID
        )

        # Step 1: Fetch test list via API
        test_list = post_json(
            request,
            "/api/v4/artifacts/test/list",
            {"profileId": resolved_effective},
            profile_id=resolved_actual,
            effective_profile_id=resolved_effective,
        )
        assert test_list is not None

        # Step 2: Navigate to benchmark page → verify test list renders
        page.goto(f"{base_url}/benchmark")
        page.wait_for_load_state("networkidle")

        benchmark_container = page.get_by_test_id("benchmark-container")
        benchmark_container.wait_for(state="visible", timeout=15000)
        expect(benchmark_container).to_be_visible()

        # Step 3: Get first test detail (if any tests exist)
        items = test_list.get("items", [])
        if items:
            first_test = items[0]
            test_id = first_test.get("id") or first_test.get("testId")
            if test_id:
                test_detail = post_json(
                    request,
                    "/api/v4/artifacts/test/get",
                    {"testId": test_id},
                    profile_id=resolved_actual,
                    effective_profile_id=resolved_effective,
                )
                assert test_detail is not None

                # Step 4: Click on test entry → navigate to test detail page
                page.goto(f"{base_url}/benchmark/t/{test_id}")
                page.wait_for_load_state("networkidle")

        # Step 5: Create a new test via API (if applicable)
        # test_data = post_json(request, "/api/v4/artifacts/test/create", {...})
        # created_ids.append(test_data["testId"])

        # Step 6: Archive test (if applicable)
        # post_json(request, "/api/v4/artifacts/test/archive", {"testId": test_id})

    finally:
        for cid in created_ids:
            try:
                post_json(
                    request,
                    "/api/v4/artifacts/test/archive",
                    {"testId": cid},
                    profile_id=ADMIN_PROFILE_ID,
                    bypass_cache=False,
                )
            except Exception:
                pass
