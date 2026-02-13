"""Shared helpers for v4 E2E tests."""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

from playwright.sync_api import APIRequestContext

from server.tests.e2e.conftest import _build_test_headers

API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")
ADMIN_PROFILE_ID = "6a2518eb-eba7-4650-aee0-d387c3fb8265"
GUEST_PROFILE_ID = "965bd24f-dfae-4063-b370-e1373df46322"

_PROFILE_RESOLUTION_CACHE: dict[tuple[str, str], tuple[str, str]] = {}


def generate_unique_name(prefix: str = "E2E") -> str:
    """Return a unique name for create/update flows."""
    timestamp = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:6]
    return f"{prefix} {timestamp}-{suffix}"


def post_json(
    request: APIRequestContext,
    path: str,
    payload: dict[str, Any],
    *,
    profile_id: str = ADMIN_PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Universal API caller with signed test headers."""
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


def resolve_profile_ids(
    request: APIRequestContext,
    *,
    profile_id: str = ADMIN_PROFILE_ID,
    effective_profile_id: str | None = None,
    pathname: str = "/home",
) -> tuple[str, str]:
    """Resolve profile IDs to ensure they are valid UUIDs (cached)."""
    effective = effective_profile_id or profile_id
    cache_key = (profile_id, effective)
    if cache_key in _PROFILE_RESOLUTION_CACHE:
        return _PROFILE_RESOLUTION_CACHE[cache_key]

    data = post_json(
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
    _PROFILE_RESOLUTION_CACHE[cache_key] = (resolved_actual, resolved_effective)
    return resolved_actual, resolved_effective
