"""Shared helpers for provider and model E2E tests."""

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


def generate_unique_provider_name(prefix: str = "E2E Provider") -> str:
    """Return a unique provider name for create/update flows."""
    timestamp = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:6]
    return f"{prefix} {timestamp}-{suffix}"


def generate_unique_model_name(prefix: str = "E2E Model") -> str:
    """Return a unique model name for create/update flows."""
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
    pathname: str = "/system/providers",
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


def fetch_providers_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch providers list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/providers/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_provider_detail(
    request: APIRequestContext,
    provider_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch provider detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/providers/detail",
        {"providerId": provider_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_model_detail(
    request: APIRequestContext,
    model_id: str,
    provider_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch model detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v3/providers/models/detail",
        {
            "modelId": model_id,
            "providerId": provider_id,
            "profileId": resolved_effective,
        },
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_provider_api(
    request: APIRequestContext,
    *,
    name: str,
    description: str,
    api_key: str,
    base_url: str | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Create a provider via the API and return its ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload: dict[str, Any] = {
        "name": name,
        "description": description,
        "api_key": api_key,
    }
    if base_url:
        payload["base_url"] = base_url

    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/providers/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    provider_id = data.get("providerId")
    if not provider_id:
        raise ValueError("Create provider response missing providerId")
    return str(provider_id)


def create_model_api(
    request: APIRequestContext,
    *,
    provider_id: str,
    name: str,
    description: str,
    input_ppm: float = 0.0,
    output_ppm: float = 0.0,
    active: bool = True,
    custom_model: bool = False,
    image_model: bool = False,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Create a model via the API and return its ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload = {
        "provider_id": provider_id,
        "name": name,
        "description": description,
        "input_ppm": input_ppm,
        "output_ppm": output_ppm,
        "active": active,
        "custom_model": custom_model,
        "image_model": image_model,
    }
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/providers/models/create",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    model_id = data.get("modelId")
    if not model_id:
        raise ValueError("Create model response missing modelId")
    return str(model_id)


def update_provider_api(
    request: APIRequestContext,
    provider_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Update a provider via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload: dict[str, Any] = {"providerId": provider_id}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if api_key is not None:
        payload["api_key"] = api_key
    if base_url is not None:
        payload["base_url"] = base_url

    _post_json(
        request,
        "/api/v3/providers/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def update_model_api(
    request: APIRequestContext,
    model_id: str,
    provider_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    input_ppm: float | None = None,
    output_ppm: float | None = None,
    active: bool | None = None,
    custom_model: bool | None = None,
    image_model: bool | None = None,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Update a model via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    payload: dict[str, Any] = {
        "modelId": model_id,
        "providerId": provider_id,
    }
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if input_ppm is not None:
        payload["input_ppm"] = input_ppm
    if output_ppm is not None:
        payload["output_ppm"] = output_ppm
    if active is not None:
        payload["active"] = active
    if custom_model is not None:
        payload["custom_model"] = custom_model
    if image_model is not None:
        payload["image_model"] = image_model

    _post_json(
        request,
        "/api/v3/providers/models/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_provider_api(
    request: APIRequestContext,
    provider_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a provider via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/providers/delete",
        {"providerId": provider_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_model_api(
    request: APIRequestContext,
    model_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a model via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v3/providers/models/delete",
        {"modelId": model_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def duplicate_provider_api(
    request: APIRequestContext,
    provider_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Duplicate a provider via the API and return the new provider ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/providers/duplicate",
        {"providerId": provider_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    new_provider_id = data.get("providerId")
    if not new_provider_id:
        raise ValueError("Duplicate provider response missing providerId")
    return str(new_provider_id)


def duplicate_model_api(
    request: APIRequestContext,
    model_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """Duplicate a model via the API and return the new model ID."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    data: dict[str, Any] = _post_json(
        request,
        "/api/v3/providers/models/duplicate",
        {"modelId": model_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    new_model_id = data.get("modelId")
    if not new_model_id:
        raise ValueError("Duplicate model response missing modelId")
    return str(new_model_id)


def find_editable_provider(
    providers: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Return the first provider that can be edited."""
    for provider in providers:
        if provider.get("can_edit"):
            return provider
    raise ValueError("No editable provider found in providers list")


def find_editable_model(
    models: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Return the first model that can be edited."""
    for model in models:
        if model.get("can_edit"):
            return model
    raise ValueError("No editable model found in models list")
