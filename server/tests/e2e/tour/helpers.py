"""Shared helpers for tour E2E tests."""

from __future__ import annotations

import json
import os
from typing import Any

from playwright.sync_api import APIRequestContext

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
    pathname: str = "/",
) -> tuple[str, str]:
    """Resolve placeholder profile IDs (like guest-profile-id) to real UUIDs."""
    effective = effective_profile_id or profile_id
    cache_key = (profile_id, effective)
    if cache_key in _PROFILE_RESOLUTION_CACHE:
        return _PROFILE_RESOLUTION_CACHE[cache_key]

    data = _post_json(
        request,
        "/api/v3/profile/context",
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
