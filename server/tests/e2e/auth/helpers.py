"""Shared helpers for auth E2E tests."""

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


def fetch_profile_context(
    request: APIRequestContext,
    *,
    actual_profile_id: str,
    effective_profile_id: str,
    pathname: str = "/",
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch profile context via the signed API."""
    payload = {
        "actualProfileId": actual_profile_id,
        "effectiveProfileId": effective_profile_id,
        "pathname": pathname,
    }
    return _post_json(
        request,
        "/api/v3/profile/context",
        payload,
        profile_id=actual_profile_id,
        effective_profile_id=effective_profile_id,
        bypass_cache=bypass_cache,
    )


def authorize_emulation(
    request: APIRequestContext,
    *,
    requester_profile_id: str,
    target_profile_id: str,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Check if profile emulation is authorized."""
    payload = {
        "requesterProfileId": requester_profile_id,
        "targetProfileId": target_profile_id,
    }
    return _post_json(
        request,
        "/api/v3/profile/authorize-emulation",
        payload,
        profile_id=requester_profile_id,
        effective_profile_id=requester_profile_id,
        bypass_cache=bypass_cache,
    )


def get_profile_by_alias(
    request: APIRequestContext,
    alias: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch profile by alias."""
    effective_id = effective_profile_id or profile_id
    payload = {"alias": alias}
    return _post_json(
        request,
        "/api/v3/profile/by-alias",
        payload,
        profile_id=profile_id,
        effective_profile_id=effective_id,
        bypass_cache=bypass_cache,
    )


def get_profile_detail(
    request: APIRequestContext,
    profile_id: str,
    *,
    current_profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch profile detail."""
    effective_id = effective_profile_id or current_profile_id
    payload = {"profileId": profile_id}
    return _post_json(
        request,
        "/api/v3/profile/detail",
        payload,
        profile_id=current_profile_id,
        effective_profile_id=effective_id,
        bypass_cache=bypass_cache,
    )


def get_simulatable_profiles(
    request: APIRequestContext,
    requester_profile_id: str,
    *,
    bypass_cache: bool = True,
) -> list[dict[str, Any]]:
    """Get list of profiles that can be emulated by requester."""
    # This uses the authorize-emulation endpoint logic
    # We can test authorization for multiple profiles to find simulatable ones
    # For now, return empty list - this would require a dedicated endpoint
    # or we can use authorize_emulation in a loop
    return []
