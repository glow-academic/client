"""Cohort event declarations for centralized delivery."""

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


def _cohort_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve cohort IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("cohort_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("cohort_id")
        ]
    )


def _cohort_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated cohort ID from output."""
    del arguments
    return _uuid_list([output.get("cohort_id")])


def _cohort_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _cohort_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


COHORT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.cohort.viewed": None},
        scope="entity",
        entity_key="cohort_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _cohort_request_entity_ids(
            arguments, output, "cohort_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events={"artifacts.cohort.created": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_cohort_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events={"artifacts.cohort.updated": None},
        scope="entity",
        entity_key="cohort_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_cohort_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events={"artifacts.cohort.deleted": None},
        scope="entity",
        entity_key="cohort_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_cohort_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events={"artifacts.cohort.duplicated": None},
        scope="entity",
        entity_key="cohort_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_cohort_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events={"artifacts.cohort.draft.saved": None},
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_cohort_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events={"artifacts.cohort.drafts.viewed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events={"artifacts.cohort.search.performed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events={"artifacts.cohort.docs.viewed": None},
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _cohort_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events={"artifacts.cohort.exported": None},
        scope="collection",
        entity_key="cohort_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _cohort_request_entity_ids(
            arguments, output, "cohort_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.cohort.refreshed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

COHORT_EVENTS = ArtifactEventsConfig(
    artifact="cohort",
    operations=COHORT_EVENT_CONFIGS,
)


def get_cohort_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a cohort operation."""
    return COHORT_EVENTS.get_operation(operation)
