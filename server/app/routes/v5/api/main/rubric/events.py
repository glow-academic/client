"""Rubric event declarations for centralized delivery."""

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


def _rubric_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve rubric IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("rubric_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("rubric_id")
        ]
    )


def _rubric_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated rubric ID from output."""
    del arguments
    return _uuid_list([output.get("rubric_id")])


def _rubric_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _rubric_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


RUBRIC_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.rubric.viewed": None},
        scope="entity",
        entity_key="rubric_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _rubric_request_entity_ids(
            arguments, output, "rubric_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events={"artifacts.rubric.created": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_rubric_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events={"artifacts.rubric.updated": None},
        scope="entity",
        entity_key="rubric_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_rubric_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events={"artifacts.rubric.deleted": None},
        scope="entity",
        entity_key="rubric_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_rubric_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events={"artifacts.rubric.duplicated": None},
        scope="entity",
        entity_key="rubric_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_rubric_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events={"artifacts.rubric.draft.saved": None},
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_rubric_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events={"artifacts.rubric.drafts.viewed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events={"artifacts.rubric.search.performed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events={"artifacts.rubric.docs.viewed": None},
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _rubric_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events={"artifacts.rubric.exported": None},
        scope="collection",
        entity_key="rubric_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _rubric_request_entity_ids(
            arguments, output, "rubric_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.rubric.refreshed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

RUBRIC_EVENTS = ArtifactEventsConfig(
    artifact="rubric",
    operations=RUBRIC_EVENT_CONFIGS,
)


def get_rubric_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a rubric operation."""
    return RUBRIC_EVENTS.get_operation(operation)
