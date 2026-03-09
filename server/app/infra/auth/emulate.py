"""Resolve emulation grant — composes canonical black boxes.

Given a requester and target profile_id:
  1. resolve_profile_identity_context → requester + target identity
  2. Authorization check (self-emulation or role hierarchy)
  3. search_sessions → find active sessions for both profiles
  4. create_grant → create grant entry + profile link
  5. create_emulation → create emulation entry + profile link
  6. Construct URLs in Python

No inline SQL.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import quote
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
    actor_name: str | None
    grant_id: UUID | None
    expires_at: datetime | None
    target_profile_id: UUID
    redirect_url: str | None
    logout_url: str | None
    emulate_page_url: str | None


async def resolve_emulation(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    requester_profile_id: UUID,
    target_profile_id: UUID,
    ttl_minutes: int = 120,
    return_url: str | None = None,
    bypass_cache: bool = False,
) -> EmulationResult:
    """Create an emulation grant using canonical black boxes.

    Returns an EmulationResult with allowed=False if authorization fails.
    """
    # Step 1: Resolve requester identity
    requester = await resolve_profile_identity_context(
        pool, requester_profile_id, redis, bypass_cache=bypass_cache
    )
    if not requester:
        return EmulationResult(
            allowed=False,
            reason="Requester profile not found",
            actor_name=None,
            grant_id=None,
            expires_at=None,
            target_profile_id=target_profile_id,
            redirect_url=None,
            logout_url=None,
            emulate_page_url=None,
        )

    # Step 2: Resolve target identity
    target = await resolve_profile_identity_context(
        pool, target_profile_id, redis, bypass_cache=bypass_cache
    )
    if not target:
        return EmulationResult(
            allowed=False,
            reason="Target profile not found",
            actor_name=requester.name,
            grant_id=None,
            expires_at=None,
            target_profile_id=target_profile_id,
            redirect_url=None,
            logout_url=None,
            emulate_page_url=None,
        )

    # Step 3: Authorization check
    is_self = requester_profile_id == target_profile_id
    allowed_roles = SIMULATABLE_ROLES.get(requester.role, set())
    is_allowed = is_self or target.role in allowed_roles

    if not is_allowed:
        return EmulationResult(
            allowed=False,
            reason="You do not have permission to emulate this profile",
            actor_name=requester.name,
            grant_id=None,
            expires_at=None,
            target_profile_id=target_profile_id,
            redirect_url=None,
            logout_url=None,
            emulate_page_url=None,
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
            actor_name=requester.name,
            grant_id=None,
            expires_at=None,
            target_profile_id=target_profile_id,
            redirect_url=None,
            logout_url=None,
            emulate_page_url=None,
        )

    async with pool.acquire() as conn:
        target_sessions = await search_sessions(
            conn, profile_ids=[target.profiles_id], active=True, limit=1
        )
    if not target_sessions:
        return EmulationResult(
            allowed=False,
            reason="No active session found for target",
            actor_name=requester.name,
            grant_id=None,
            expires_at=None,
            target_profile_id=target_profile_id,
            redirect_url=None,
            logout_url=None,
            emulate_page_url=None,
        )

    requester_session_id = requester_sessions[0].id
    target_session_id = target_sessions[0].id

    # Step 5: Create grant + profile link
    expires_at = datetime.now(UTC) + timedelta(minutes=ttl_minutes)
    async with pool.acquire() as conn:
        async with conn.transaction():
            grant_result = await create_grant(
                conn,
                session_id=requester_session_id,
                expires_at=expires_at,
                profiles_id=requester.profiles_id,
            )

            # Step 6: Create emulation + profile link
            await create_emulation(
                conn,
                grant_id=grant_result.id,
                session_id=target_session_id,
                profile_id=target.profiles_id,
            )

    # Step 7: Construct URLs
    origin = os.getenv("ORIGIN", "http://localhost:3000").rstrip("/")
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")
    prefix = f"/{app_prefix}" if app_prefix else ""

    signin_base_url = f"{origin}{prefix}/api/auth/signin/keycloak"
    callback_url = quote(f"{origin}{prefix}/", safe="")
    idp_alias = "default-idp"

    redirect_url = (
        f"{signin_base_url}"
        f"?callbackUrl={callback_url}"
        f"&kc_idp_hint={idp_alias}"
        f"&login_hint={grant_result.id}"
    )

    return_url_encoded = quote(return_url, safe="") if return_url else callback_url

    emulate_page_url = (
        f"{origin}{prefix}/emulate"
        f"?grant={grant_result.id}"
        f"&returnUrl={return_url_encoded}"
    )

    is_local_dev = "localhost" in origin.lower()
    default_keycloak_url = (
        "http://localhost:8080/auth" if is_local_dev else f"{origin}{prefix}/auth"
    )
    keycloak_public_url = os.getenv("KEYCLOAK_PUBLIC_URL", default_keycloak_url)
    keycloak_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")

    logout_url = (
        f"{keycloak_public_url}/realms/master/protocol/openid-connect/logout"
        f"?client_id={quote(keycloak_client_id, safe='')}"
        f"&post_logout_redirect_uri={quote(emulate_page_url, safe='')}"
    )

    return EmulationResult(
        allowed=True,
        reason=None,
        actor_name=requester.name,
        grant_id=grant_result.id,
        expires_at=expires_at,
        target_profile_id=target_profile_id,
        redirect_url=redirect_url,
        logout_url=logout_url,
        emulate_page_url=emulate_page_url,
    )
