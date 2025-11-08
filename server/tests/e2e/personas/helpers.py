"""Shared helpers for persona E2E tests."""

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


def generate_unique_persona_name(prefix: str = "E2E Persona") -> str:
    """Return a unique persona name for create/update flows."""
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
    pathname: str = "/create/personas",
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


def fetch_personas_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    bypass_cache: bool = True,
) -> Dict[str, Any]:
    """Fetch personas list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/personas/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_persona_detail(
    request: APIRequestContext,
    persona_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    bypass_cache: bool = True,
) -> Dict[str, Any]:
    """Fetch persona detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/personas/detail",
        {"personaId": persona_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_persona_detail_default(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    bypass_cache: bool = True,
) -> Dict[str, Any]:
    """Fetch default persona detail used when creating new personas."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/personas/detail-default",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_persona_api(
    request: APIRequestContext,
    *,
    name: str,
    description: str,
    system_prompt: str,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
    department_ids: Optional[list[str]] = None,
    color: Optional[str] = None,
    icon: Optional[str] = None,
    model_id: Optional[str] = None,
    reasoning: Optional[str] = None,
    temperature: Optional[float] = None,
) -> str:
    """Create a persona via the API and return its ID."""
    defaults = fetch_persona_detail_default(
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
        "description": description,
        "department_ids": department_ids,
        "active": True,
        "color": color or defaults.get("color") or "#3B82F6",
        "icon": icon or defaults.get("icon") or "Sparkles",
        "model_id": model_id or defaults.get("model_id"),
        "reasoning": reasoning or defaults.get("reasoning"),
        "temperature": float(
            temperature if temperature is not None else defaults.get("temperature") or 0.0
        ),
        "system_prompt": system_prompt,
        "prompt_id": None,
    }
    data: Dict[str, Any] = _post_json(
        request,
        "/api/v3/personas/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    persona_id = data.get("personaId")
    if not persona_id:
        raise ValueError("Create persona response missing personaId")
    return str(persona_id)


def delete_persona_api(
    request: APIRequestContext,
    persona_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: Optional[str] = None,
) -> None:
    """Delete a persona via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/personas/delete",
        {"personaId": persona_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_persona(
    personas: Iterable[Dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> Dict[str, Any]:
    """Return the first persona that matches edit requirements."""
    for persona in personas:
        if not persona.get("can_edit"):
            continue
        dept_ids = persona.get("department_ids") or []
        if require_department_specific is None:
            return persona
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return persona
        if require_department_specific is False and not is_dept_specific:
            return persona
    raise ValueError("No matching editable persona found in persona list")


