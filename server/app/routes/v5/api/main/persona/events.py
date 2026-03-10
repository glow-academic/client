"""Persona event declarations for future centralized delivery."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    default_filter_events,
    require_authenticated_profile,
)
from app.infra.persona.permissions import (
    compute_can_create,
    compute_can_delete,
    compute_can_draft,
    compute_can_duplicate,
    compute_can_edit,
    has_access,
)
from app.infra.persona.permissions_context import resolve_persona_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context

EventRecord = dict[str, Any]

CALL_LIFECYCLE_EVENTS: tuple[str, ...] = (
    "call.started",
    "call.completed",
    "call.failed",
)


async def _resolve_profile(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
) -> Any | None:
    """Resolve actor identity for event authorization."""
    return await resolve_profile_identity_context(
        pool,
        profile_id,
        redis,
        session_id=session_id,
        draft_id=draft_id,
    )


async def _can_subscribe_persona_read(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Read-level visibility for persona entity or collection events."""
    del event_types
    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    if profile is None:
        return False

    if entity_id is None:
        return True

    perms = await resolve_persona_permissions_context(pool, entity_id)
    if not perms.exists:
        return False

    return has_access(
        profile.role,
        profile.department_ids,
        perms.department_ids,
    )


async def _can_subscribe_persona_create(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Create-level visibility for persona collection events."""
    del entity_id, event_types
    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    if profile is None:
        return False

    # Collection-scoped create events do not carry department scope yet.
    return compute_can_create(profile.role, ["department-scoped"])


async def _can_subscribe_persona_edit(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Edit-level visibility for persona entity events."""
    del event_types
    if entity_id is None:
        return False

    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    if profile is None:
        return False

    perms = await resolve_persona_permissions_context(pool, entity_id)
    if not perms.exists:
        return False

    return compute_can_edit(
        user_role=profile.role,
        persona_department_ids=perms.department_ids,
        active_scenario_count=perms.active_scenario_count,
        user_department_ids=profile.department_ids,
    )


async def _can_subscribe_persona_delete(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Delete-level visibility for persona entity events."""
    del event_types
    if entity_id is None:
        return False

    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    if profile is None:
        return False

    perms = await resolve_persona_permissions_context(pool, entity_id)
    if not perms.exists:
        return False

    return compute_can_delete(
        user_role=profile.role,
        persona_department_ids=perms.department_ids,
        active_scenario_count=perms.active_scenario_count,
    )


async def _can_subscribe_persona_duplicate(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Duplicate-level visibility for persona entity events."""
    del entity_id, event_types
    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    if profile is None:
        return False

    return compute_can_duplicate(profile.role)


async def _can_subscribe_persona_draft(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Draft-level visibility for persona draft entity/collection events."""
    del entity_id, event_types
    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    if profile is None:
        return False

    return compute_can_draft(profile.role)


async def _passthrough_filter(
    profile_id: UUID,
    events: list[EventRecord],
) -> list[EventRecord]:
    """Default event filter placeholder."""
    return await default_filter_events(profile_id, events)


PERSONA_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("persona.viewed",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_read,
        filter_events=_passthrough_filter,
    ),
    "create": OperationEventConfig(
        operation="create",
        domain_events=("persona.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_persona_create,
    ),
    "update": OperationEventConfig(
        operation="update",
        domain_events=("persona.updated",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_edit,
    ),
    "delete": OperationEventConfig(
        operation="delete",
        domain_events=("persona.deleted",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_delete,
    ),
    "duplicate": OperationEventConfig(
        operation="duplicate",
        domain_events=("persona.duplicated",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_duplicate,
    ),
    "draft": OperationEventConfig(
        operation="draft",
        domain_events=("persona.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=_can_subscribe_persona_draft,
    ),
    "drafts": OperationEventConfig(
        operation="drafts",
        domain_events=("persona.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_persona_draft,
        include_call_lifecycle=False,
    ),
    "search": OperationEventConfig(
        operation="search",
        domain_events=("persona.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_persona_read,
        include_call_lifecycle=False,
    ),
    "docs": OperationEventConfig(
        operation="docs",
        domain_events=("persona.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=require_authenticated_profile,
    ),
    "export": OperationEventConfig(
        operation="export",
        domain_events=("persona.exported",),
        scope="collection",
        entity_key="persona_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("persona.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PERSONA_EVENTS = ArtifactEventsConfig(
    artifact="persona",
    operations=PERSONA_EVENT_CONFIGS,
    call_lifecycle_events=CALL_LIFECYCLE_EVENTS,
)

PERSONA_EVENT_TYPES: tuple[str, ...] = PERSONA_EVENTS.event_types


def get_persona_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a persona operation."""
    return PERSONA_EVENTS.get_operation(operation)
