"""Resolve callback redirect — composes canonical black boxes.

Given a profile_id after login:
  1. resolve_profile_identity_context → get role
  2. Compute redirect path based on role

No inline SQL.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context

# Roles that always land on /home
_HOME_ROLES = {"member", "instructional", "admin", "superadmin"}


async def resolve_callback_redirect(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> str:
    """Resolve the redirect path for a profile after login.

    Returns '/home' as default fallback.
    """
    if not profile_id:
        return "/home"

    identity = await resolve_profile_identity_context(
        conn, profile_id, redis, bypass_cache=bypass_cache
    )
    if not identity:
        return "/home"

    # Business rule: member/instructional/admin/superadmin → /home
    # All other roles (guest, custom) → /home fallback
    if identity.role in _HOME_ROLES:
        return "/home"

    return "/home"
