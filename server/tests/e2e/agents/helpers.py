"""Shared helpers for agent E2E tests."""

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


def generate_unique_agent_name(prefix: str = "E2E Agent") -> str:
    """Return a unique agent name for create/update flows."""
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
    pathname: str = "/management/agents",
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


def fetch_agents_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch agents list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/agents/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_agent_detail(
    request: APIRequestContext,
    agent_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch agent detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/agents/detail",
        {"agentId": agent_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_agent_detail_default(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch default agent detail used when creating new agents."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/agents/new",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_agent_api(
    request: APIRequestContext,
    *,
    name: str,
    description: str,
    system_prompt: str,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    department_ids: list[str] | None = None,
    model_id: str | None = None,
    role: str | None = None,
    reasoning: str | None = None,
    temperature: float | None = None,
    active: bool | None = None,
    prompt_id: str | None = None,
) -> str:
    """Create an agent via the API and return its ID."""
    defaults = fetch_agent_detail_default(
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
    # Get default model_id - use first valid_model_id if model_id is empty
    default_model_id = defaults.get("model_id") or ""
    if not default_model_id and defaults.get("valid_model_ids"):
        default_model_id = defaults["valid_model_ids"][0]

    payload = {
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
        "department_ids": department_ids,
        "model_id": model_id or default_model_id,
        "role": role or defaults.get("role") or "assistant",
        "reasoning": reasoning or defaults.get("reasoning"),
        "temperature": float(
            temperature
            if temperature is not None
            else defaults.get("temperature") or 0.7
        ),
        "active": active if active is not None else True,
        "prompt_id": prompt_id,
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/agents/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    agent_id = data.get("agentId")
    if not agent_id:
        raise ValueError("Create agent response missing agentId")
    return str(agent_id)


def delete_agent_api(
    request: APIRequestContext,
    agent_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete an agent via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/agents/delete",
        {"agentId": agent_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_agent(
    agents: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first agent that matches edit requirements."""
    for agent in agents:
        if not agent.get("can_edit"):
            continue
        dept_ids = agent.get("department_ids") or []
        if require_department_specific is None:
            return agent
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return agent
        if require_department_specific is False and not is_dept_specific:
            return agent
    raise ValueError("No matching editable agent found in agent list")
