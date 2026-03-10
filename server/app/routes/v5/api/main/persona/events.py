"""Persona event declarations for future centralized delivery.

This module is intentionally declarative:
  - which persona operations emit which domain events
  - which operations also expose call lifecycle events
  - who can subscribe to each operation stream

It does not define any HTTP/SSE/webhook endpoints.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

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

EventScope = Literal["entity", "collection"]
EventRecord = dict[str, Any]
CanSubscribe = Callable[..., Awaitable[bool]]
FilterEvents = Callable[[UUID, list[EventRecord]], Awaitable[list[EventRecord]]]

CALL_LIFECYCLE_EVENTS: tuple[str, ...] = (
    "call.started",
    "call.completed",
    "call.failed",
)


@dataclass(frozen=True)
class PersonaEventConfig:
    """Declarative event policy for a single persona operation."""

    operation: str
    domain_events: tuple[str, ...]
    scope: EventScope
    entity_key: str | None
    can_subscribe: CanSubscribe
    filter_events: FilterEvents | None = None
    include_call_lifecycle: bool = True

    @property
    def all_event_types(self) -> tuple[str, ...]:
        """Return domain events plus lifecycle events when enabled."""
        if self.include_call_lifecycle:
            return (*self.domain_events, *CALL_LIFECYCLE_EVENTS)
        return self.domain_events


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


async def _can_subscribe_authenticated(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Fallback for operations that currently only require an authenticated profile."""
    del entity_id, event_types
    profile = await _resolve_profile(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
    return profile is not None


async def _passthrough_filter(
    profile_id: UUID,
    events: list[EventRecord],
) -> list[EventRecord]:
    """Default event filter placeholder."""
    del profile_id
    return events


PERSONA_EVENT_CONFIGS: dict[str, PersonaEventConfig] = {
    "get": PersonaEventConfig(
        operation="get",
        domain_events=("persona.viewed",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_read,
        filter_events=_passthrough_filter,
    ),
    "create": PersonaEventConfig(
        operation="create",
        domain_events=("persona.created",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_persona_create,
    ),
    "update": PersonaEventConfig(
        operation="update",
        domain_events=("persona.updated",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_edit,
    ),
    "delete": PersonaEventConfig(
        operation="delete",
        domain_events=("persona.deleted",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_delete,
    ),
    "duplicate": PersonaEventConfig(
        operation="duplicate",
        domain_events=("persona.duplicated",),
        scope="entity",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_persona_duplicate,
    ),
    "draft": PersonaEventConfig(
        operation="draft",
        domain_events=("persona.draft.saved",),
        scope="entity",
        entity_key="draft_id",
        can_subscribe=_can_subscribe_persona_draft,
    ),
    "drafts": PersonaEventConfig(
        operation="drafts",
        domain_events=("persona.drafts.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_persona_draft,
        include_call_lifecycle=False,
    ),
    "search": PersonaEventConfig(
        operation="search",
        domain_events=("persona.search.performed",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_persona_read,
        include_call_lifecycle=False,
    ),
    "docs": PersonaEventConfig(
        operation="docs",
        domain_events=("persona.docs.viewed",),
        scope="entity",
        entity_key="entity_id",
        can_subscribe=_can_subscribe_authenticated,
    ),
    "export": PersonaEventConfig(
        operation="export",
        domain_events=("persona.exported",),
        scope="collection",
        entity_key="persona_id",
        can_subscribe=_can_subscribe_authenticated,
    ),
    "refresh": PersonaEventConfig(
        operation="refresh",
        domain_events=("persona.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=_can_subscribe_authenticated,
    ),
}

PERSONA_EVENT_TYPES: tuple[str, ...] = tuple(
    dict.fromkeys(
        event_type
        for config in PERSONA_EVENT_CONFIGS.values()
        for event_type in config.all_event_types
    )
)


def get_persona_event_config(operation: str) -> PersonaEventConfig | None:
    """Resolve event policy for a persona operation."""
    return PERSONA_EVENT_CONFIGS.get(operation)
