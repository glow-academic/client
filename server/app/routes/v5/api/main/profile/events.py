"""Profile event declarations for centralized delivery."""

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


def _profile_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve profile IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("profile_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("profile_id")
        ]
    )


def _profile_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated profile ID from output."""
    del arguments
    return _uuid_list([output.get("profile_id")])


def _profile_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _profile_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


PROFILE_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "context": OperationEventConfig(
        operation="context",
        domain_events=("artifacts.profile.context.viewed",),
        scope="entity",
        entity_key="profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _profile_request_entity_ids(
            arguments, output, "profile_id"
        ),
    ),
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.profile.viewed",),
        scope="entity",
        entity_key="target_profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _profile_request_entity_ids(
            arguments, output, "target_profile_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("artifacts.profile.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_profile_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("artifacts.profile.updated",),
        scope="entity",
        entity_key="profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_profile_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("artifacts.profile.deleted",),
        scope="entity",
        entity_key="profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_profile_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("artifacts.profile.duplicated",),
        scope="entity",
        entity_key="target_profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_profile_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("artifacts.profile.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_profile_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("artifacts.profile.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("artifacts.profile.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("artifacts.profile.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _profile_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("artifacts.profile.exported",),
        scope="collection",
        entity_key="profile_export_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _profile_request_entity_ids(
            arguments, output, "profile_export_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.profile.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "emulate": OperationEventConfig(
        operation="emulate",
        domain_events=("artifacts.profile.emulated",),
        scope="entity",
        entity_key="target_profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _profile_request_entity_ids(
            arguments, output, "target_profile_id"
        ),
    ),
    "unemulate": OperationEventConfig(
        operation="unemulate",
        domain_events=("artifacts.profile.unemulated",),
        scope="entity",
        entity_key="profile_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _profile_request_entity_ids(
            arguments, output, "profile_id"
        ),
    ),
}

PROFILE_EVENTS = ArtifactEventsConfig(
    artifact="profile",
    operations=PROFILE_EVENT_CONFIGS,
)


def get_profile_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a profile operation."""
    return PROFILE_EVENTS.get_operation(operation)
