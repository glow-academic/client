"""Stream delivery — GET /v5/stream (SSE) + POST /v5/stream/{Type} (OpenAPI schema).

The SSE endpoint streams artifact events to clients.
The schema routes are dummy POST endpoints so ``openapi-typescript``
generates strongly-typed client payloads from EVENT_REGISTRY.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.infra.events.store import build_event_cursor, read_artifact_events
from app.infra.globals import get_pool, get_redis_client
from app.infra.stream.hub import subscribe as subscribe_live_events
from app.infra.stream.hub import unsubscribe as unsubscribe_live_events
from app.infra.stream.registry import EVENT_REGISTRY
from app.infra.stream.shared import resolve_subscription
from app.registry.entry_events import ENTRY_EVENTS
from app.registry.resource_events import RESOURCE_EVENTS

# --- Socket types not yet modeled as artifact operations ----------------
from app.socket.v5.client.types import (
    AttemptAssistantHintsEvent,
    AttemptAudioStopPayload,
    AttemptEndAllPayload,
    AttemptErrorEvent,
    AttemptJoinedEvent,
    AttemptJoinPayload,
    AttemptLeavePayload,
    AttemptNextPayload,
    AttemptUsePreviousPayload,
    AttemptUserCompleteEvent,
    AttemptUserDeltaEvent,
    AttemptUserProgressEvent,
    AttemptUserStartEvent,
    ConnectionConfirmedPayload,
    GeneratePayload,
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationMediaCompleteEvent,
    GenerationMediaProgressEvent,
    GenerationProgressEvent,
    GenerationSavedEvent,
    TestEndAllPayload,
    TestGroupPayload,
    TestJoinedEvent,
    TestJoinPayload,
    TestLeavePayload,
    TestNextPayload,
    TestRunDeltaEvent,
    TestRunPayload,
)

router = APIRouter(prefix="/stream", tags=["stream"])

# ---------------------------------------------------------------------------
# SSE endpoint — GET /v5/stream
# ---------------------------------------------------------------------------


@router.get("/")
async def stream_events(
    http_request: Request,
    artifact: str = Query(...),
    operation: str = Query(...),
    entity_id: UUID | None = Query(default=None),
    cursor: str | None = Query(default=None),
    types: list[str] | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> StreamingResponse:
    """Stream artifact events via SSE using the centralized declaration registry."""
    _, operation_config = await resolve_subscription(
        artifact=artifact,
        operation=operation,
        entity_id=entity_id,
        profile_id=http_request.state.profile_id,
        session_id=http_request.state.session_id,
        event_types=types,
    )

    profile_id = http_request.state.profile_id
    live_queue = subscribe_live_events(
        artifact=artifact,
        operation=operation,
        entity_id=entity_id,
        event_types=types,
    )

    async def _gen():
        current_cursor = cursor
        try:
            while True:
                events = await read_artifact_events(
                    get_pool(),
                    get_redis_client(),
                    artifact=artifact,
                    operation=operation,
                    entity_id=entity_id,
                    cursor=current_cursor,
                    event_types=types,
                    limit=limit,
                )
                if operation_config.filter_events is not None:
                    events = await operation_config.filter_events(profile_id, events)

                if events:
                    for event in events:
                        current_cursor = build_event_cursor(event)
                        yield f"id: {event.id}\n"
                        yield f"event: {event.event_type}\n"
                        yield f"data: {event.model_dump_json()}\n\n"
                    continue

                try:
                    live_event = await asyncio.wait_for(live_queue.get(), timeout=1.0)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue

                filtered_events = [live_event]
                if operation_config.filter_events is not None:
                    filtered_events = await operation_config.filter_events(
                        profile_id, filtered_events
                    )

                for event in filtered_events:
                    current_cursor = build_event_cursor(event)
                    yield f"id: {event.id}\n"
                    yield f"event: {event.event_type}\n"
                    yield f"data: {event.model_dump_json()}\n\n"
        finally:
            unsubscribe_live_events(live_queue)

    return StreamingResponse(_gen(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# OpenAPI schema — POST /v5/stream/{ModelName}
# ---------------------------------------------------------------------------

_models: dict[str, type[BaseModel]] = {}
_model_tags: dict[str, str] = {}  # model name → parent router tag

# Mapping from EVENT_REGISTRY key (singular) to router tag (as in URL prefix)
_ARTIFACT_TAGS: dict[str, str] = {
    "activity": "activity",
    "agent": "agents",
    "attempt": "attempt",
    "auth": "auths",
    "benchmark": "benchmark",
    "chat": "chat",
    "cohort": "cohorts",
    "dashboard": "dashboard",
    "department": "departments",
    "document": "documents",
    "eval": "evals",
    "field": "fields",
    "group": "group",
    "health": "health",
    "home": "home",
    "invocation": "invocation",
    "leaderboard": "leaderboard",
    "model": "models",
    "parameter": "parameters",
    "persona": "personas",
    "pricing": "pricing",
    "practice": "practice",
    "profile": "profiles",
    "provider": "providers",
    "record": "record",
    "reports": "reports",
    "rubric": "rubrics",
    "scenario": "scenarios",
    "session": "session",
    "setting": "settings",
    "simulation": "simulations",
    "test": "test",
    "tool": "tools",
}

# Mapping from RESOURCE_SCHEMAS key → parent router tag.
# Sub-resources are grouped under the artifact they belong to.
_RESOURCE_PARENT_TAGS: dict[str, str] = {
    # Top-level artifacts — map to themselves
    "agents": "agents",
    "auths": "auths",
    "cohorts": "cohorts",
    "departments": "departments",
    "documents": "documents",
    "evals": "evals",
    "fields": "fields",
    "models": "models",
    "parameters": "parameters",
    "personas": "personas",
    "pricing": "pricing",
    "profiles": "profiles",
    "providers": "providers",
    "rubrics": "rubrics",
    "scenarios": "scenarios",
    "settings": "settings",
    "simulations": "simulations",
    "tools": "tools",
    # Sub-resources of tools
    "args": "tools",
    "arg_positions": "tools",
    "args_outputs": "tools",
    # Sub-resources of auths
    "auth_item_keys": "auths",
    "items": "auths",
    "keys": "auths",
    "protocols": "auths",
    # Sub-resources of scenarios
    "flags": "scenarios",
    "images": "scenarios",
    "objectives": "scenarios",
    "options": "scenarios",
    "problem_statements": "scenarios",
    "questions": "scenarios",
    "scenario_flags": "scenarios",
    "scenario_positions": "scenarios",
    "scenario_rubrics": "scenarios",
    "scenario_time_limits": "scenarios",
    "videos": "scenarios",
    # Sub-resources of simulations
    "simulation_availability": "simulations",
    "simulation_positions": "simulations",
    # Sub-resources of rubrics
    "points": "rubrics",
    "standard_groups": "rubrics",
    "standards": "rubrics",
    "thresholds": "rubrics",
    # Sub-resources of models
    "modalities": "models",
    "qualities": "models",
    "reasoning_levels": "models",
    "temperature_levels": "models",
    "voices": "models",
    # Sub-resources of agents
    "instructions": "agents",
    "prompts": "agents",
    # Sub-resources of providers
    "endpoints": "providers",
    "provider_keys": "providers",
    # Sub-resources of profiles
    "emails": "profiles",
    "profile_personas": "profiles",
    "request_limits": "profiles",
    # Sub-resources of parameters/fields
    "conditional_parameters": "parameters",
    "parameter_fields": "parameters",
    # Sub-resources of personas
    "examples": "personas",
    # Sub-resources of documents
    "texts": "documents",
    "uploads": "documents",
    # Sub-resources of settings
    "colors": "settings",
    "icons": "settings",
    "roles": "settings",
    # Sub-resources of groups/tests
    "group_positions": "group",
    "group_rubrics": "group",
    "run_positions": "test",
    "run_rubrics": "test",
    # Generic/shared — keep under their own name
    "artifacts": "artifacts",
    "descriptions": "descriptions",
    "entries": "entries",
    "names": "names",
    "operations": "operations",
    "resources": "resources",
    "slugs": "slugs",
    "values": "values",
}


def _register(model: type[BaseModel] | None, tag: str | None = None) -> None:
    if model is not None and model.__name__ not in _models:
        _models[model.__name__] = model
        if tag:
            _model_tags[model.__name__] = tag


# 1. Artifact operations (EVENT_REGISTRY) — tag with parent router
for _artifact_key, _config in EVENT_REGISTRY.items():
    _tag = _ARTIFACT_TAGS.get(_artifact_key, _artifact_key)
    for _op in _config.operations.values():
        for _m in _op.lifecycle_models.values():
            _register(_m, tag=_tag)
        for _m in _op.domain_events.values():
            _register(_m, tag=_tag)

# 2. Entry generation events — belong to attempt flow
for _m in ENTRY_EVENTS.values():
    _register(_m, tag="attempt")

# 3. Resource generation events — tag with parent router
for _res_name, _m in RESOURCE_EVENTS.items():
    _register(_m, tag=_RESOURCE_PARENT_TAGS.get(_res_name, _res_name))

# 4. Socket types not yet in EVENT_REGISTRY — tag by prefix
_EXTRA_SOCKET_TYPES: list[type[BaseModel]] = [
    ConnectionConfirmedPayload,
    GeneratePayload,
    GenerationProgressEvent,
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationSavedEvent,
    GenerationMediaProgressEvent,
    GenerationMediaCompleteEvent,
    AttemptJoinPayload,
    AttemptLeavePayload,
    AttemptJoinedEvent,
    AttemptNextPayload,
    AttemptEndAllPayload,
    AttemptUsePreviousPayload,
    AttemptAudioStopPayload,
    AttemptErrorEvent,
    AttemptAssistantHintsEvent,
    AttemptUserStartEvent,
    AttemptUserProgressEvent,
    AttemptUserCompleteEvent,
    AttemptUserDeltaEvent,
    TestJoinPayload,
    TestLeavePayload,
    TestJoinedEvent,
    TestNextPayload,
    TestRunPayload,
    TestGroupPayload,
    TestEndAllPayload,
    TestRunDeltaEvent,
]

for _m in _EXTRA_SOCKET_TYPES:
    _name = _m.__name__
    if _name.startswith("Attempt"):
        _register(_m, tag="attempt")
    elif _name.startswith("Test"):
        _register(_m, tag="test")
    elif _name.startswith("Generation") or _name.startswith("Generate"):
        _register(_m, tag="group")
    elif _name.startswith("Connection"):
        _register(_m, tag="session")
    else:
        _register(_m)


def _make_endpoint(model: type[BaseModel]) -> Callable[..., Any]:
    async def endpoint(request: Any) -> dict[str, bool]:
        return {"success": True}

    endpoint.__name__ = f"{model.__name__}_schema"
    endpoint.__qualname__ = f"{model.__name__}_schema"
    endpoint.__annotations__["request"] = model
    endpoint.__annotations__["return"] = dict[str, bool]
    return endpoint


for _name, _model in sorted(_models.items()):
    _extra_tags = [_model_tags[_name]] if _name in _model_tags else []
    router.add_api_route(
        f"/{_name}",
        _make_endpoint(_model),
        methods=["POST"],
        tags=_extra_tags,
        name=f"{_name}_schema",
        summary=f"Schema: {_name}",
    )
