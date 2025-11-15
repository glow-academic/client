"""Shared helpers for department E2E tests."""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Dict, Iterable, Optional

from playwright.sync_api import APIRequestContext

from server.tests.e2e.conftest import BASE_URL, PROFILE_ID, _build_test_headers

API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")
print(f"[E2E] Using profile_id={PROFILE_ID} api_base={API_BASE}")
_PROFILE_RESOLUTION_CACHE: Dict[tuple[str, str], tuple[str, str]] = {}


def generate_unique_department_name(prefix: str = "E2E Department") -> str:
    """Return a unique department name for create/update flows."""
    timestamp = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:6]
    return f"{prefix} {timestamp}-{suffix}"


def _post_json(
    request: APIRequestContext,
    path: str,
    payload: Dict[str, Any],
    *,
    profile_id: str,
    effective_profile_id: Optional[str],
    bypass_cache: bool,
) -> Dict[str, Any]:
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
    effective_profile_id: Optional[str],
    pathname: str = "/system/departments",
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


def fetch_departments_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    bypass_cache: bool = True,
) -> Dict[str, Any]:
    """Fetch departments list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/departments/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_department_detail(
    request: APIRequestContext,
    department_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    bypass_cache: bool = True,
) -> Dict[str, Any]:
    """Fetch department detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/departments/detail",
        {"departmentId": department_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_department_detail_default(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    bypass_cache: bool = True,
) -> Dict[str, Any]:
    """Fetch default department detail used when creating new departments."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/departments/detail-default",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_department_api(
    request: APIRequestContext,
    *,
    title: str,
    description: str,
    active: bool = True,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
) -> str:
    """Create a department via the API and return its ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {
        "title": title,
        "description": description,
        "active": active,
        "profile_id": resolved_effective,
    }
    data: Dict[str, Any] = _post_json(
        request,
        "/api/v3/departments/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    department_id = data.get("departmentId")
    if not department_id:
        raise ValueError("Create department response missing departmentId")
    return str(department_id)


def update_department_api(
    request: APIRequestContext,
    department_id: str,
    *,
    title: str,
    description: str,
    active: bool,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
) -> None:
    """Update a department via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/departments/update",
        {
            "departmentId": department_id,
            "title": title,
            "description": description,
            "active": active,
        },
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_department_api(
    request: APIRequestContext,
    department_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
) -> None:
    """Delete a department via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/departments/delete",
        {"departmentId": department_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def duplicate_department_api(
    request: APIRequestContext,
    department_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
) -> str:
    """Duplicate a department via the API and return the new department ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    data: Dict[str, Any] = _post_json(
        request,
        "/api/v3/departments/duplicate",
        {"departmentId": department_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    new_department_id = data.get("departmentId")
    if not new_department_id:
        raise ValueError("Duplicate department response missing departmentId")
    return str(new_department_id)


def find_editable_department(
    departments: Iterable[Dict[str, Any]],
    *,
    require_can_delete: bool | None = None,
) -> Dict[str, Any]:
    """Return the first department that matches edit requirements."""
    for department in departments:
        if not department.get("can_edit"):
            continue
        if require_can_delete is None:
            return department
        can_delete = department.get("can_delete", False)
        if require_can_delete is True and can_delete:
            return department
        if require_can_delete is False and not can_delete:
            return department
    raise ValueError("No matching editable department found in departments list")
