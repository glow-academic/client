"""Scenario event declarations for centralized delivery."""

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


def _scenario_result_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve scenario IDs from bulk create/update/delete outputs."""
    del arguments
    return _uuid_list(
        [
            item.get("scenario_id")
            for item in output.get("results", [])
            if isinstance(item, dict) and item.get("scenario_id")
        ]
    )


def _scenario_duplicate_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve duplicated scenario ID from output."""
    del arguments
    return _uuid_list([output.get("scenario_id")])


def _scenario_request_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
    key: str,
) -> list[UUID]:
    """Resolve a single entity ID from request arguments."""
    del output
    return _uuid_list([arguments.get(key)])


def _scenario_draft_entity_ids(
    arguments: dict[str, Any],
    output: dict[str, Any],
) -> list[UUID]:
    """Resolve draft ID from output first, then request input_draft_id."""
    return _uuid_list([output.get("draft_id"), arguments.get("input_draft_id")])


SCENARIO_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.scenario.viewed",),
        scope="entity",
        entity_key="scenario_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _scenario_request_entity_ids(
            arguments, output, "scenario_id"
        ),
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("artifacts.scenario.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_scenario_result_entity_ids,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("artifacts.scenario.updated",),
        scope="entity",
        entity_key="scenario_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_scenario_result_entity_ids,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("artifacts.scenario.deleted",),
        scope="entity",
        entity_key="scenario_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_scenario_result_entity_ids,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("artifacts.scenario.duplicated",),
        scope="entity",
        entity_key="scenario_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_scenario_duplicate_entity_ids,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("artifacts.scenario.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=_scenario_draft_entity_ids,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("artifacts.scenario.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("artifacts.scenario.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("artifacts.scenario.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _scenario_request_entity_ids(
            arguments, output, "entity_id"
        ),
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("artifacts.scenario.exported",),
        scope="collection",
        entity_key="scenario_id",
        can_subscribe=require_authenticated_profile,
        resolve_entity_ids=lambda arguments, output: _scenario_request_entity_ids(
            arguments, output, "scenario_id"
        ),
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.scenario.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

SCENARIO_EVENTS = ArtifactEventsConfig(
    artifact="scenario",
    operations=SCENARIO_EVENT_CONFIGS,
)


def get_scenario_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a scenario operation."""
    return SCENARIO_EVENTS.get_operation(operation)
