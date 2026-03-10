"""Agent event declarations for centralized delivery."""

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


def _agent_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve agent IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("agent_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("agent_id")
        ]
    )


def _agent_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated agent ID from output."""
    del arguments
    return _uuid_list([output.get("agent_id")])


def _agent_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _agent_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


AGENT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.agent.viewed",),
        scope="entity",
        entity_key="agent_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _agent_request_entity_ids(
            arguments, output, "agent_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("artifacts.agent.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_agent_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("artifacts.agent.updated",),
        scope="entity",
        entity_key="agent_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_agent_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("artifacts.agent.deleted",),
        scope="entity",
        entity_key="agent_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_agent_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("artifacts.agent.duplicated",),
        scope="entity",
        entity_key="agent_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_agent_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("artifacts.agent.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_agent_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("artifacts.agent.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("artifacts.agent.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("artifacts.agent.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _agent_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("artifacts.agent.exported",),
        scope="collection",
        entity_key="agent_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _agent_request_entity_ids(
            arguments, output, "agent_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.agent.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

AGENT_EVENTS = ArtifactEventsConfig(
    artifact="agent",
    operations=AGENT_EVENT_CONFIGS,
)


def get_agent_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for an agent operation."""
    return AGENT_EVENTS.get_operation(operation)
