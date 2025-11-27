"""Shared helpers for simulation E2E tests."""

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


def generate_unique_simulation_name(prefix: str = "E2E Simulation") -> str:
    """Return a unique simulation name for create/update flows."""
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
    pathname: str = "/create/simulations",
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


def fetch_simulations_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch simulations list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/simulations/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_simulation_detail(
    request: APIRequestContext,
    simulation_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch simulation detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/simulations/detail",
        {"simulationId": simulation_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_simulation_detail_default(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch default simulation detail used when creating new simulations."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/simulations/new",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_simulation_api(
    request: APIRequestContext,
    *,
    title: str,
    description: str,
    rubric_id: str,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    department_ids: list[str] | None = None,
    active: bool = True,
    practice_simulation: bool = False,
    time_limit: int | None = None,
    scenario_ids: list[str] | list[dict[str, Any]] | None = None,
) -> str:
    """Create a simulation via the API and return its ID."""
    defaults = fetch_simulation_detail_default(
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

    # Format scenario_ids - can be list of strings or list of dicts with scenario_id and active
    formatted_scenario_ids: list[str] | list[dict[str, Any]] = []
    if scenario_ids:
        formatted_scenario_ids = scenario_ids
    elif defaults.get("valid_scenario_ids"):
        # Use first valid scenario if available
        formatted_scenario_ids = [defaults["valid_scenario_ids"][0]]

    payload = {
        "title": title,
        "description": description,
        "department_ids": department_ids,
        "active": active,
        "practice_simulation": practice_simulation,
        "time_limit": time_limit,
        "rubric_id": rubric_id or defaults.get("valid_rubric_ids", [None])[0],
        "scenario_ids": formatted_scenario_ids,
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/simulations/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    simulation_id = data.get("simulationId")
    if not simulation_id:
        raise ValueError("Create simulation response missing simulationId")
    return str(simulation_id)


def update_simulation_api(
    request: APIRequestContext,
    simulation_id: str,
    *,
    title: str | None = None,
    description: str | None = None,
    rubric_id: str | None = None,
    department_ids: list[str] | None = None,
    active: bool | None = None,
    practice_simulation: bool | None = None,
    time_limit: int | None = None,
    scenario_ids: list[dict[str, Any]] | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Update a simulation via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )

    # Fetch current simulation to merge updates
    current = fetch_simulation_detail(
        request,
        simulation_id,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=True,
    )

    # Build payload with required fields (must provide all)
    payload: dict[str, Any] = {
        "simulationId": simulation_id,
        "title": title if title is not None else current.get("name", ""),
        "description": description
        if description is not None
        else current.get("description") or "",
        "rubric_id": rubric_id
        if rubric_id is not None
        else current.get("rubric_id", ""),
        "department_ids": department_ids
        if department_ids is not None
        else current.get("department_ids"),
        "active": active if active is not None else current.get("active", True),
        "practice_simulation": practice_simulation
        if practice_simulation is not None
        else current.get("practice_simulation", False),
        "time_limit": time_limit
        if time_limit is not None
        else current.get("time_limit"),
    }

    # Handle scenario_ids - convert to proper format
    if scenario_ids is not None:
        payload["scenario_ids"] = scenario_ids
    elif current.get("scenario_ids"):
        # Convert existing scenarios to format with active flags
        scenarios = current.get("scenarios", [])
        payload["scenario_ids"] = [
            {"scenario_id": s["scenario_id"], "active": s.get("active", True)}
            for s in scenarios
        ]
    else:
        payload["scenario_ids"] = []

    _post_json(
        request,
        "/api/v3/simulations/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_simulation_api(
    request: APIRequestContext,
    simulation_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a simulation via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/simulations/delete",
        {"simulationId": simulation_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def duplicate_simulation_api(
    request: APIRequestContext,
    simulation_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Duplicate a simulation via the API and return the new simulation ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/simulations/duplicate",
        {"simulationId": simulation_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    new_simulation_id = data.get("simulationId")
    if not new_simulation_id:
        raise ValueError("Duplicate simulation response missing simulationId")
    return str(new_simulation_id)


def find_editable_simulation(
    simulations: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first simulation that matches edit requirements."""
    for simulation in simulations:
        if not simulation.get("can_edit"):
            continue
        dept_ids = simulation.get("department_ids") or []
        if require_department_specific is None:
            return simulation
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return simulation
        if require_department_specific is False and not is_dept_specific:
            return simulation
    raise ValueError("No matching editable simulation found in simulation list")
