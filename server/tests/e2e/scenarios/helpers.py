"""Shared helpers for scenario E2E tests."""

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


def generate_unique_scenario_name(prefix: str = "E2E Scenario") -> str:
    """Return a unique scenario name for create/update flows."""
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
    pathname: str = "/create/scenarios",
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


def fetch_scenarios_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch scenarios list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/scenarios/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_scenario_detail(
    request: APIRequestContext,
    scenario_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch scenario detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/scenarios/detail",
        {"scenarioId": scenario_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_scenario_detail_default(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch default scenario detail used when creating new scenarios."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/scenarios/detail-default",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_scenario_api(
    request: APIRequestContext,
    *,
    name: str,
    problem_statement: str,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    department_ids: list[str] | None = None,
    persona_ids: list[str] | None = None,
    document_ids: list[str] | None = None,
    objective_ids: list[str] | None = None,
    parameters: dict[str, list[str]] | None = None,
    active: bool = True,
    hints_enabled: bool = False,
    objectives_enabled: bool = True,
    image_input_enabled: bool = False,
    copy_paste_allowed: bool = False,
    input_guardrail_enabled: bool = False,
    output_guardrail_enabled: bool = False,
) -> str:
    """Create a scenario via the API and return its ID."""
    defaults = fetch_scenario_detail_default(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
        bypass_cache=True,
    )
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {
        "name": name,
        "problem_statement": problem_statement,
        "department_ids": department_ids or defaults.get("department_ids"),
        "active": active,
        "persona_ids": persona_ids or [],
        "document_ids": document_ids or [],
        "objective_ids": objective_ids or [],
        "parameters": parameters or {},
        "hints_enabled": hints_enabled,
        "objectives_enabled": objectives_enabled,
        "image_input_enabled": image_input_enabled,
        "copy_paste_allowed": copy_paste_allowed,
        "input_guardrail_enabled": input_guardrail_enabled,
        "output_guardrail_enabled": output_guardrail_enabled,
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/scenarios/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    scenario_id = data.get("scenarioId")
    if not scenario_id:
        raise ValueError("Create scenario response missing scenarioId")
    return str(scenario_id)


def delete_scenario_api(
    request: APIRequestContext,
    scenario_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a scenario via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/scenarios/delete",
        {"scenarioId": scenario_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_scenario(
    scenarios: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first scenario that matches edit requirements."""
    for scenario in scenarios:
        if not scenario.get("can_edit"):
            continue
        dept_ids = scenario.get("department_ids") or []
        if require_department_specific is None:
            return scenario
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return scenario
        if require_department_specific is False and not is_dept_specific:
            return scenario
    raise ValueError("No matching editable scenario found in scenario list")
