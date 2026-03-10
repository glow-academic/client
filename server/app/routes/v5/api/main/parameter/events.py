"""Parameter event declarations for centralized delivery."""

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


def _parameter_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve parameter IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("parameter_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("parameter_id")
        ]
    )


def _parameter_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated parameter ID from output."""
    del arguments
    return _uuid_list([output.get("parameter_id")])


def _parameter_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _parameter_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


PARAMETER_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.parameter.viewed",),
        scope="entity",
        entity_key="parameter_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _parameter_request_entity_ids(
            arguments, output, "parameter_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("artifacts.parameter.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_parameter_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("artifacts.parameter.updated",),
        scope="entity",
        entity_key="parameter_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_parameter_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("artifacts.parameter.deleted",),
        scope="entity",
        entity_key="parameter_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_parameter_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("artifacts.parameter.duplicated",),
        scope="entity",
        entity_key="parameter_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_parameter_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("artifacts.parameter.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_parameter_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("artifacts.parameter.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("artifacts.parameter.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("artifacts.parameter.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _parameter_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("artifacts.parameter.exported",),
        scope="collection",
        entity_key="parameter_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _parameter_request_entity_ids(
            arguments, output, "parameter_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.parameter.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PARAMETER_EVENTS = ArtifactEventsConfig(
    artifact="parameter",
    operations=PARAMETER_EVENT_CONFIGS,
)


def get_parameter_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a parameter operation."""
    return PARAMETER_EVENTS.get_operation(operation)
