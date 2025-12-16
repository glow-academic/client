"""Shared helpers for cohort E2E tests."""

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


def generate_unique_cohort_name(prefix: str = "E2E Cohort") -> str:
    """Return a unique cohort name for create/update flows."""
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
    pathname: str = "/cohorts",
) -> tuple[str, str]:
    """Resolve profile IDs to ensure they are valid UUIDs."""
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


def fetch_cohorts_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch cohorts list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/cohorts/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_cohort_detail(
    request: APIRequestContext,
    cohort_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch cohort detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/cohorts/detail",
        {"cohortId": cohort_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_cohort_new(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch default cohort detail used when creating new cohorts."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/cohorts/new",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_cohort_api(
    request: APIRequestContext,
    *,
    name: str,
    description: str | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    department_ids: list[str] | None = None,
    profile_ids: list[str] | None = None,
    simulation_ids: list[str] | None = None,
    active: bool = True,
) -> str:
    """Create a cohort via the API and return its ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {
        "title": name,
        "description": description,
        "active": active,
        "department_ids": department_ids or [],
        "profile_ids": profile_ids or [],
        "simulation_ids": simulation_ids or [],
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/cohorts/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    cohort_id = data.get("cohortId")
    if not cohort_id:
        raise ValueError("Create cohort response missing cohortId")
    return str(cohort_id)


def update_cohort_api(
    request: APIRequestContext,
    cohort_id: str,
    *,
    title: str | None = None,
    description: str | None = None,
    active: bool | None = None,
    department_ids: list[str] | None = None,
    profile_ids: list[str] | None = None,
    simulation_ids: list[str] | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Update a cohort via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    # Fetch current cohort to get existing values
    current = fetch_cohort_detail(
        request,
        cohort_id,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=True,
    )
    payload = {
        "cohortId": cohort_id,
        "title": title if title is not None else current.get("title", ""),
        "description": description
        if description is not None
        else current.get("description"),
        "active": active if active is not None else current.get("active", True),
        "department_ids": department_ids
        if department_ids is not None
        else (current.get("department_ids") or []),
        "profile_ids": profile_ids
        if profile_ids is not None
        else (current.get("profile_ids") or []),
        "simulation_ids": simulation_ids
        if simulation_ids is not None
        else (current.get("simulation_ids") or []),
    }
    _post_json(
        request,
        "/api/v3/cohorts/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_cohort_api(
    request: APIRequestContext,
    cohort_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a cohort via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/cohorts/delete",
        {"cohortId": cohort_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def duplicate_cohort_api(
    request: APIRequestContext,
    cohort_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Duplicate a cohort via the API and return the new cohort ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/cohorts/duplicate",
        {"cohortId": cohort_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    new_cohort_id = data.get("cohortId")
    if not new_cohort_id:
        raise ValueError("Duplicate cohort response missing cohortId")
    return str(new_cohort_id)


def leave_cohort_api(
    request: APIRequestContext,
    cohort_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Leave a cohort via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/cohorts/leave",
        {"cohortId": cohort_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_cohort(
    cohorts: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first cohort that matches edit requirements."""
    for cohort in cohorts:
        if not cohort.get("can_edit"):
            continue
        dept_ids = cohort.get("department_ids") or []
        if require_department_specific is None:
            return cohort
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return cohort
        if require_department_specific is False and not is_dept_specific:
            return cohort
    raise ValueError("No matching editable cohort found in cohort list")
