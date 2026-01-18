"""Shared helpers for staff E2E tests."""

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


def generate_unique_staff_name(prefix: str = "E2E Staff") -> str:
    """Return a unique staff name for create/update flows."""
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
    pathname: str = "/management/staff",
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


def fetch_staff_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch staff list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/staff/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_staff_detail(
    request: APIRequestContext,
    profile_id: str,
    *,
    current_profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch staff detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=current_profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/staff/detail",
        {"profileId": profile_id, "currentProfileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_staff_api(
    request: APIRequestContext,
    *,
    first_name: str,
    last_name: str,
    email: str,
    role: str,
    department_id: str | None = None,
    requests_per_day: int | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Create a staff member via the API and return its profile ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {
        "firstName": first_name,
        "lastName": last_name,
        "emails": [email],
        "primary_email_index": 0,
        "role": role,
        "primary_department_id": department_id,
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v4/staff/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    profile_id_created = data.get("profileId")
    if not profile_id_created:
        raise ValueError("Create staff response missing profileId")

    # Set requests_per_day if provided
    if requests_per_day is not None:
        update_staff_api(
            request,
            profile_id=profile_id_created,
            role=role,
            requests_per_day=requests_per_day,
            department_id=department_id or "",
            active=True,
            current_profile_id=resolved_effective,
            effective_profile_id=resolved_effective,
        )

    return str(profile_id_created)


def update_staff_api(
    request: APIRequestContext,
    profile_id: str,
    *,
    role: str,
    requests_per_day: int | None,
    department_id: str,
    active: bool,
    current_profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> dict[str, Any]:
    """Update a staff member via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=current_profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/staff/update",
        {
            "profileId": profile_id,
            "role": role,
            "requests_per_day": requests_per_day,
            "department_id": department_id,
            "active": active,
        },
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def bulk_update_staff_api(
    request: APIRequestContext,
    profile_ids: list[str],
    *,
    role: str | None = None,
    requests_per_day: int | str | None = None,
    current_profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> dict[str, Any]:
    """Bulk update staff members via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=current_profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload: dict[str, Any] = {
        "profileIds": profile_ids,
        "currentProfileId": resolved_effective,
    }
    if role is not None:
        payload["role"] = role
    if requests_per_day is not None:
        payload["requests_per_day"] = requests_per_day

    return _post_json(
        request,
        "/api/v4/staff/bulk/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_staff_api(
    request: APIRequestContext,
    profile_id: str,
    *,
    current_profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a staff member via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=current_profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v4/staff/delete",
        {"profileId": profile_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def bulk_delete_staff_api(
    request: APIRequestContext,
    profile_ids: list[str],
    *,
    current_profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Bulk delete staff members via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=current_profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v4/staff/bulk/delete",
        {"profileIds": profile_ids},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_staff(
    staff_list: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Return the first staff member that can be edited."""
    for staff in staff_list:
        if staff.get("can_edit"):
            return staff
    raise ValueError("No editable staff member found in staff list")


def find_deletable_staff(
    staff_list: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Return the first staff member that can be deleted."""
    for staff in staff_list:
        if staff.get("can_delete"):
            return staff
    raise ValueError("No deletable staff member found in staff list")
