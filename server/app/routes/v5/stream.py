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

    async def _gen():
        current_cursor = cursor
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
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(1.0)

    return StreamingResponse(_gen(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# OpenAPI schema — POST /v5/stream/{ModelName}
# ---------------------------------------------------------------------------

_models: dict[str, type[BaseModel]] = {}


def _register(model: type[BaseModel] | None) -> None:
    if model is not None and model.__name__ not in _models:
        _models[model.__name__] = model


# 1. Artifact operations (EVENT_REGISTRY)
for _config in EVENT_REGISTRY.values():
    for _op in _config.operations.values():
        for _m in _op.lifecycle_models.values():
            _register(_m)
        for _m in _op.domain_events.values():
            _register(_m)

# 2. Entry generation events
for _m in ENTRY_EVENTS.values():
    _register(_m)

# 3. Resource generation events
for _m in RESOURCE_EVENTS.values():
    _register(_m)

# 4. Socket types not yet in EVENT_REGISTRY
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
    _register(_m)


def _make_endpoint(model: type[BaseModel]) -> Callable[..., Any]:
    async def endpoint(request: model) -> dict[str, bool]:  # type: ignore[valid-type]
        return {"success": True}

    endpoint.__name__ = f"{model.__name__}_schema"
    endpoint.__qualname__ = f"{model.__name__}_schema"
    return endpoint


for _name, _model in sorted(_models.items()):
    router.add_api_route(
        f"/{_name}",
        _make_endpoint(_model),
        methods=["POST"],
        name=f"{_name}_schema",
        summary=f"Schema: {_name}",
    )
