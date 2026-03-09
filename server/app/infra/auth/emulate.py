"""Resolve emulation grant — composes canonical black boxes.

Given a requester and target profile_id:
  1. resolve_profile_identity_context → requester + target identity
  2. Authorization check (role hierarchy)
  3. search_sessions → find active sessions for both profiles
  4. create_grant → create grant entry + profile link
  5. create_emulation → create emulation entry + profile link

Server-side resolve_identity() picks up the active grant on the next request
and swaps the effective profile_id — no client-side redirect needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.auth.simulatable import SIMULATABLE_ROLES
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.entries.emulations.create import create_emulation
from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.sessions.search import search_sessions


@dataclass(frozen=True)
class EmulationResult:
    """Result of an emulation grant creation."""

    allowed: bool
    reason: str | None
    grant_id: UUID | None
    expires_at: datetime | None


async def resolve_emulation(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    requester_profile_id: UUID,
    target_profile_id: UUID,
    ttl_minutes: int = 120,
    bypass_cache: bool = False,
) -> EmulationResult:
    """Create an emulation grant using canonical black boxes.

    Returns an EmulationResult with allowed=False if authorization fails.
    On success, resolve_identity() will pick up the grant on the next request.
    """
    # Step 1: Resolve requester identity
    requester = await resolve_profile_identity_context(
        pool, requester_profile_id, redis, bypass_cache=bypass_cache
    )
    if not requester:
        return EmulationResult(
            allowed=False,
            reason="Requester profile not found",
            grant_id=None,
            expires_at=None,
        )

    # Step 2: Resolve target identity
    target = await resolve_profile_identity_context(
        pool, target_profile_id, redis, bypass_cache=bypass_cache
    )
    if not target:
        return EmulationResult(
            allowed=False,
            reason="Target profile not found",
            grant_id=None,
            expires_at=None,
        )

    # Step 3: Authorization check
    is_self = requester_profile_id == target_profile_id
    allowed_roles = SIMULATABLE_ROLES.get(requester.role, set())
    is_allowed = is_self or target.role in allowed_roles

    if not is_allowed:
        return EmulationResult(
            allowed=False,
            reason="You do not have permission to emulate this profile",
            grant_id=None,
            expires_at=None,
        )

    # Step 4: Find active sessions for requester and target
    async with pool.acquire() as conn:
        requester_sessions = await search_sessions(
            conn, profile_ids=[requester.profiles_id], active=True, limit=1
        )
    if not requester_sessions:
        return EmulationResult(
            allowed=False,
            reason="No active session found for requester",
            grant_id=None,
            expires_at=None,
        )

    async with pool.acquire() as conn:
        target_sessions = await search_sessions(
            conn, profile_ids=[target.profiles_id], active=True, limit=1
        )
    if not target_sessions:
        return EmulationResult(
            allowed=False,
            reason="No active session found for target",
            grant_id=None,
            expires_at=None,
        )

    requester_session_id = requester_sessions[0].id
    target_session_id = target_sessions[0].id

    # Step 5: Create grant + emulation in a single transaction
    expires_at = datetime.now(UTC) + timedelta(minutes=ttl_minutes)
    async with pool.acquire() as conn:
        async with conn.transaction():
            grant_result = await create_grant(
                conn,
                session_id=requester_session_id,
                expires_at=expires_at,
                profiles_id=requester.profiles_id,
            )

            await create_emulation(
                conn,
                grant_id=grant_result.id,
                session_id=target_session_id,
                profile_id=target.profiles_id,
            )

    return EmulationResult(
        allowed=True,
        reason=None,
        grant_id=grant_result.id,
        expires_at=expires_at,
    )
