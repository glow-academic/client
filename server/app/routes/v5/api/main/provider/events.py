"""Provider event declarations for centralized delivery."""

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


def _provider_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve provider IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("provider_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("provider_id")
        ]
    )


def _provider_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated provider ID from output."""
    del arguments
    return _uuid_list([output.get("provider_id")])


def _provider_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _provider_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


PROVIDER_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.provider.viewed",),
        scope="entity",
        entity_key="provider_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _provider_request_entity_ids(
            arguments, output, "provider_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("artifacts.provider.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_provider_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("artifacts.provider.updated",),
        scope="entity",
        entity_key="provider_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_provider_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("artifacts.provider.deleted",),
        scope="entity",
        entity_key="provider_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_provider_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("artifacts.provider.duplicated",),
        scope="entity",
        entity_key="provider_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_provider_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("artifacts.provider.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_provider_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("artifacts.provider.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("artifacts.provider.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("artifacts.provider.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _provider_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("artifacts.provider.exported",),
        scope="collection",
        entity_key="provider_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _provider_request_entity_ids(
            arguments, output, "provider_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.provider.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PROVIDER_EVENTS = ArtifactEventsConfig(
    artifact="provider",
    operations=PROVIDER_EVENT_CONFIGS,
)


def get_provider_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a provider operation."""
    return PROVIDER_EVENTS.get_operation(operation)
