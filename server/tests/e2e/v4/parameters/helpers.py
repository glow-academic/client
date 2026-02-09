"""Shared helpers for parameter E2E tests."""

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


def generate_unique_parameter_name(prefix: str = "E2E Parameter") -> str:
    """Return a unique parameter name for create/update flows."""
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
    pathname: str = "/management/parameters",
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


def fetch_parameters_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch parameters list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/artifacts/parameters/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_parameter_detail(
    request: APIRequestContext,
    parameter_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch parameter detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/artifacts/parameters/detail",
        {"parameterId": parameter_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_parameter_new(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch default parameter detail used when creating new parameters."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/artifacts/parameters/new",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_parameter_api(
    request: APIRequestContext,
    *,
    name: str,
    description: str,
    numerical: bool = False,
    active: bool = True,
    document_parameter: bool = False,
    simulation_parameter: bool = False,
    department_ids: list[str] | None = None,
    parameter_items: list[dict[str, Any]] | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Create a parameter via the API and return its ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    # Default to empty list if not provided
    if parameter_items is None:
        parameter_items = [
            {
                "name": "Default Item",
                "description": "Default parameter item",
                "value": "default",
            }
        ]
    payload = {
        "name": name,
        "description": description,
        "numerical": numerical,
        "active": active,
        "document_parameter": document_parameter,
        "simulation_parameter": simulation_parameter,
        "department_ids": department_ids,
        "parameter_items": parameter_items,
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v4/artifacts/parameters/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    parameter_id = data.get("parameterId")
    if not parameter_id:
        raise ValueError("Create parameter response missing parameterId")
    return str(parameter_id)


def update_parameter_api(
    request: APIRequestContext,
    parameter_id: str,
    updates: dict[str, Any],
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> dict[str, Any]:
    """Update a parameter via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {"parameterId": parameter_id, **updates}
    return _post_json(
        request,
        "/api/v4/artifacts/parameters/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_parameter_api(
    request: APIRequestContext,
    parameter_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a parameter via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v4/artifacts/parameters/delete",
        {"parameterId": parameter_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def duplicate_parameter_api(
    request: APIRequestContext,
    parameter_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Duplicate a parameter via the API and return the new parameter ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    data: dict[str, Any] = _post_json(
        request,
        "/api/v4/artifacts/parameters/duplicate",
        {"parameterId": parameter_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    new_parameter_id = data.get("parameterId")
    if not new_parameter_id:
        raise ValueError("Duplicate parameter response missing parameterId")
    return str(new_parameter_id)


def find_editable_parameter(
    parameters: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first parameter that matches edit requirements."""
    for parameter in parameters:
        if not parameter.get("can_edit"):
            continue
        dept_ids = parameter.get("department_ids") or []
        if require_department_specific is None:
            return parameter
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return parameter
        if require_department_specific is False and not is_dept_specific:
            return parameter
    raise ValueError("No matching editable parameter found in parameter list")
