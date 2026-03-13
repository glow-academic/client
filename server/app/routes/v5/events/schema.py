"""Auto-generated OpenAPI schema routes derived from event declarations.

Exposes every unique Pydantic model referenced in EVENT_REGISTRY,
ENTRY_EVENTS, and RESOURCE_EVENTS as a dummy POST endpoint so that
``openapi-typescript`` generates strongly-typed client payloads.

This replaces the manually maintained dummy routes that previously lived
in ``socket/server/routes.py``, ``socket/client/routes.py``,
``socket/server/entries/__init__.py``, and
``socket/server/resources/__init__.py``.

Types are defined once (Pydantic models), referenced in event
declarations (EVENT_REGISTRY), and OpenAPI schema is derived here.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.registry.entry_events import ENTRY_EVENTS
from app.registry.resource_events import RESOURCE_EVENTS
from app.routes.v5.events.registry import EVENT_REGISTRY

# --- Socket types not yet modeled as artifact operations ----------------
# These will shrink as operations are added to EVENT_REGISTRY.
from app.routes.v5.socket.client.types import (
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

schema_router = APIRouter(prefix="/schema", tags=["event-schemas"])

# ---------------------------------------------------------------------------
# Collect unique models
# ---------------------------------------------------------------------------

_models: dict[str, type[BaseModel]] = {}


def _register(model: type[BaseModel] | None) -> None:
    if model is not None and model.__name__ not in _models:
        _models[model.__name__] = model


# 1. Artifact operations (EVENT_REGISTRY) — lifecycle + domain models
for _config in EVENT_REGISTRY.values():
    for _op in _config.operations.values():
        for _m in _op.lifecycle_models.values():
            _register(_m)
        for _m in _op.domain_events.values():
            _register(_m)

# 2. Entry generation events (dynamic per entry type)
for _m in ENTRY_EVENTS.values():
    _register(_m)

# 3. Resource generation events (dynamic per resource type)
for _m in RESOURCE_EVENTS.values():
    _register(_m)

# 4. Socket types not yet in EVENT_REGISTRY
_EXTRA_SOCKET_TYPES: list[type[BaseModel]] = [
    # Connection lifecycle
    ConnectionConfirmedPayload,
    # Generation lifecycle
    GeneratePayload,
    GenerationProgressEvent,
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationSavedEvent,
    GenerationMediaProgressEvent,
    GenerationMediaCompleteEvent,
    # Attempt room management
    AttemptJoinPayload,
    AttemptLeavePayload,
    AttemptJoinedEvent,
    # Attempt actions not modeled as operations
    AttemptNextPayload,
    AttemptEndAllPayload,
    AttemptUsePreviousPayload,
    AttemptAudioStopPayload,
    AttemptErrorEvent,
    AttemptAssistantHintsEvent,
    # Attempt user streaming (audio/voice)
    AttemptUserStartEvent,
    AttemptUserProgressEvent,
    AttemptUserCompleteEvent,
    AttemptUserDeltaEvent,
    # Test room management
    TestJoinPayload,
    TestLeavePayload,
    TestJoinedEvent,
    # Test actions not modeled as operations
    TestNextPayload,
    TestRunPayload,
    TestGroupPayload,
    TestEndAllPayload,
    TestRunDeltaEvent,
]

for _m in _EXTRA_SOCKET_TYPES:
    _register(_m)

# ---------------------------------------------------------------------------
# Generate one dummy endpoint per unique model
# ---------------------------------------------------------------------------


def _make_endpoint(model: type[BaseModel]) -> Callable[..., Any]:
    async def endpoint(request: model) -> dict[str, bool]:  # type: ignore[valid-type]
        return {"success": True}

    endpoint.__name__ = f"{model.__name__}_schema"
    endpoint.__qualname__ = f"{model.__name__}_schema"
    return endpoint


for _name, _model in sorted(_models.items()):
    schema_router.add_api_route(
        f"/{_name}",
        _make_endpoint(_model),
        methods=["POST"],
        name=f"{_name}_schema",
        summary=f"Schema: {_name}",
    )
