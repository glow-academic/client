"""Model event declarations for centralized delivery."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)


def _uuid_list(values: list[Any] | None) -> list[UUID]:
    """Normalize a list of UUID-like values."""
    return [UUID(str(value)) for value in values or [] if value]


def _model_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve model IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("model_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("model_id")
        ]
    )


def _model_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated model ID from output."""
    del arguments
    return _uuid_list([output.get("model_id")])


def _model_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _model_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


MODEL_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.model.viewed",),
        scope="entity",
        entity_key="model_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _model_request_entity_ids(
            arguments, output, "model_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("artifacts.model.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_model_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("artifacts.model.updated",),
        scope="entity",
        entity_key="model_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_model_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("artifacts.model.deleted",),
        scope="entity",
        entity_key="model_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_model_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("artifacts.model.duplicated",),
        scope="entity",
        entity_key="model_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_model_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("artifacts.model.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_model_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("artifacts.model.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("artifacts.model.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("artifacts.model.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _model_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("artifacts.model.exported",),
        scope="collection",
        entity_key="model_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _model_request_entity_ids(
            arguments, output, "model_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.model.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

MODEL_EVENTS = ArtifactEventsConfig(
    artifact="model",
    operations=MODEL_EVENT_CONFIGS,
)


def get_model_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a model operation."""
    return MODEL_EVENTS.get_operation(operation)
