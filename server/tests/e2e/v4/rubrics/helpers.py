"""Shared helpers for rubric E2E tests."""

from __future__ import annotations

import json
import os
import time
import uuid
from collections.abc import Iterable
from typing import Any

from playwright.sync_api import APIRequestContext

from server.tests.e2e.conftest import PROFILE_ID, _build_test_headers

API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")
print(f"[E2E] Using profile_id={PROFILE_ID} api_base={API_BASE}")
_PROFILE_RESOLUTION_CACHE: dict[tuple[str, str], tuple[str, str]] = {}


def generate_unique_rubric_name(prefix: str = "E2E Rubric") -> str:
    """Return a unique rubric name for create/update flows."""
    timestamp = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:6]
    return f"{prefix} {timestamp}-{suffix}"


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
    pathname: str = "/intelligence/rubrics",
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


def fetch_rubrics_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch rubrics list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/artifacts/rubrics/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_rubric_detail(
    request: APIRequestContext,
    rubric_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch rubric detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/artifacts/rubrics/detail",
        {"rubricId": rubric_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_rubric_new(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch default rubric data used when creating new rubrics."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/artifacts/rubrics/new",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_rubric_api(
    request: APIRequestContext,
    *,
    name: str,
    description: str,
    department_ids: list[str] | None = None,
    active: bool = True,
    points: int = 0,
    passPoints: int = 0,
    standard_groups: list[dict[str, Any]] | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Create a rubric via the API and return its ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {
        "name": name,
        "description": description,
        "department_ids": department_ids or [],
        "active": active,
        "points": points,
        "passPoints": passPoints,
        "standard_groups": standard_groups or [],
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v4/artifacts/rubrics/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    rubric_id = data.get("rubricId")
    if not rubric_id:
        raise ValueError("Create rubric response missing rubricId")
    return str(rubric_id)


def delete_rubric_api(
    request: APIRequestContext,
    rubric_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a rubric via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v4/artifacts/rubrics/delete",
        {"rubricId": rubric_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_rubric(
    rubrics: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first rubric that matches edit requirements."""
    for rubric in rubrics:
        if not rubric.get("can_edit"):
            continue
        dept_ids = rubric.get("department_ids") or []
        if require_department_specific is None:
            return rubric
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return rubric
        if require_department_specific is False and not is_dept_specific:
            return rubric
    raise ValueError("No matching editable rubric found in rubric list")
