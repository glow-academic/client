"""Resolve profile context from a profile artifact ID.

Given a profile_id (artifact), fetches the profile artifact's junctions,
hydrates resources in parallel, and returns a clean ProfileContext with
identity, role metadata, emails, departments, and settings.

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.artifacts.profile.get import (
    get_profiles as get_profile_artifacts,
)
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.emails.get import get_emails
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.roles.get import get_roles


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProfileContext:
    """Hydrated profile context for use by downstream infra layers."""

    profiles_id: UUID  # resource ID (from profile_profiles_junction)
    name: str
    role: str  # enum value: "superadmin", "admin", etc.
    role_name: str  # display name from roles_resource
    role_description: str
    role_artifacts: list[str]  # artifact types this role can access
    primary_email: str | None
    emails: list[str]  # all emails
    primary_department_id: UUID | None
    department_ids: list[UUID]  # all department IDs
    settings_id: UUID | None  # from primary department's setting_ids[0]
    is_active: bool


# ---------------------------------------------------------------------------
# resolve_profile_context
# ---------------------------------------------------------------------------


async def resolve_profile_context(
    conn: asyncpg.Connection,
    profile_id: UUID,
    redis: Redis,
    bypass_cache: bool = False,
) -> ProfileContext | None:
    """Resolve a profile artifact ID into a hydrated ProfileContext.

    Two sequential steps:
      1. get_profile_artifacts — fetches junction IDs
      2. asyncio.gather — hydrates all resources in parallel
    Then pure Python assembly.
    """
    # Step 1: fetch profile artifact with all needed junctions
    artifacts = await get_profile_artifacts(
        conn,
        [profile_id],
        names=True,
        roles=True,
        departments=True,
        emails=True,
        profiles=True,
        flags=True,
    )
    if not artifacts:
        return None

    artifact = artifacts[0]

    # Extract junction IDs
    name_ids = artifact.name_ids or []
    role_ids = artifact.role_ids or []
    department_ids = artifact.department_ids or []
    email_ids = artifact.email_ids or []
    profile_ids = artifact.profile_ids or []

    if not profile_ids:
        return None

    profiles_id = profile_ids[0]

    # Step 2: hydrate all resources in parallel
    names_res, roles_res, depts_res, emails_res = await asyncio.gather(
        get_names(conn, name_ids, redis, bypass_cache) if name_ids else _empty(),
        get_roles(conn, role_ids, redis, bypass_cache) if role_ids else _empty(),
        get_departments(conn, department_ids, redis, bypass_cache)
        if department_ids
        else _empty(),
        get_emails(conn, email_ids, redis, bypass_cache) if email_ids else _empty(),
    )

    # Step 3: extract values
    name = names_res[0].name if names_res else ""

    role = ""
    role_name = ""
    role_description = ""
    role_artifacts: list[str] = []
    if roles_res:
        r = roles_res[0]
        role = r.role
        role_name = r.name
        role_description = r.description
        role_artifacts = r.artifacts

    # Primary department: find the one with is_primary=True on the resource
    primary_department_id: UUID | None = None
    settings_id: UUID | None = None
    for dept in depts_res:
        if dept.is_primary:
            primary_department_id = dept.id
            if dept.setting_ids:
                settings_id = dept.setting_ids[0]
            break

    # Primary email: find the one with is_primary=True on the resource
    primary_email: str | None = None
    for email in emails_res:
        if email.is_primary:
            primary_email = email.email
            break

    all_emails = [e.email for e in emails_res]
    all_department_ids = [d.id for d in depts_res]

    # is_active: check if profile has an active "profile_active" flag
    # The artifact's active field reflects this
    is_active = artifact.active

    return ProfileContext(
        profiles_id=profiles_id,
        name=name,
        role=role,
        role_name=role_name,
        role_description=role_description,
        role_artifacts=role_artifacts,
        primary_email=primary_email,
        emails=all_emails,
        primary_department_id=primary_department_id,
        department_ids=all_department_ids,
        settings_id=settings_id,
        is_active=is_active,
    )


async def _empty() -> list:
    return []
