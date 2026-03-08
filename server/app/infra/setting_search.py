"""Setting search logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments, name)
  2. search_settings (artifact) — core artifact search (IDs + total_count)
  3. get_settings (artifact) — hydrate junction IDs
  4. Resource get tools — hydrate names, descriptions
  5. Permissions — compute per-setting can_edit, can_delete, can_duplicate
  6. Keys — fetch accessible keys via direct SQL (unique to settings)
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.api.main.setting.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.setting.types import (
    ListSettingApiKey,
    ListSettingApiResponse,
    ListSettingApiSetting,
)
from app.routes.v5.tools.artifacts.setting.get import get_settings
from app.routes.v5.tools.artifacts.setting.search import (
    search_settings as search_setting_artifacts,
)
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.get import get_names


async def search_setting_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ListSettingApiResponse:
    """Setting search using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, departments, name
      2. search_settings → (setting_artifact_ids, total_count)
      3. get_settings → hydrate junction IDs
      4. Parallel: hydrate resources + fetch keys
      5. Compute permissions per setting
    """
    from fastapi import HTTPException

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    user_role = profile.role
    user_department_ids = profile.department_ids
    actor_name = profile.name

    # ── Step 2: Search settings ────────────────────────────────────────

    setting_ids, _total_count = await search_setting_artifacts(
        conn,
        limit_count=1000,
        offset_count=0,
    )

    if not setting_ids:
        return _empty_response(actor_name, user_role)

    # ── Step 3: Get setting artifacts with junction IDs ────────────────

    artifacts = await get_settings(
        conn,
        setting_ids,
        names=True,
        descriptions=True,
        departments=True,
        flags=True,
    )

    # ── Step 4: Parallel hydration + keys fetch ────────────────────────

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])

    (
        names_data,
        descriptions_data,
        keys_data,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty_list(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty_list(),
        _fetch_keys(conn, user_role, user_department_ids),
    )

    # Build lookup maps
    name_map = {n.id: n for n in names_data}
    description_map = {d.id: d for d in descriptions_data}

    # ── Step 5: Build setting list with permissions ────────────────────

    settings_list: list[ListSettingApiSetting] = []

    for a in artifacts:
        name_obj = name_map.get(a.name_ids[0]) if a.name_ids else None
        desc_obj = (
            description_map.get(a.description_ids[0]) if a.description_ids else None
        )

        dept_ids_str = [str(d) for d in (a.department_ids or [])]

        can_edit = compute_can_edit(
            user_role=user_role,
            setting_department_ids=dept_ids_str,
            user_department_ids=user_department_ids,
        )
        can_delete = compute_can_delete(
            user_role=user_role,
            setting_department_ids=dept_ids_str,
        )
        can_duplicate = compute_can_duplicate(user_role)

        settings_list.append(
            ListSettingApiSetting(
                settings_id=a.id,
                created_at=a.created_at,
                active=a.active,
                name=name_obj.name if name_obj else None,
                description=desc_obj.description if desc_obj else None,
                department_ids=dept_ids_str,
                can_edit=can_edit,
                can_delete=can_delete,
                can_duplicate=can_duplicate,
            )
        )

    return ListSettingApiResponse(
        actor_name=actor_name,
        user_role=user_role,
        settings=settings_list,
        keys=keys_data,
    )


# ── Helpers ────────────────────────────────────────────────────────────


def _empty_response(
    actor_name: str | None = None,
    user_role: str | None = None,
) -> ListSettingApiResponse:
    return ListSettingApiResponse(
        actor_name=actor_name,
        user_role=user_role,
        settings=[],
        keys=[],
    )


async def _empty_list() -> list:
    return []


async def _fetch_keys(
    conn: asyncpg.Connection,
    user_role: str | None,
    user_department_ids: list[UUID],
) -> list[ListSettingApiKey]:
    """Fetch accessible keys for the user.

    Replicates the settings list SQL logic for keys:
    - Include keys with matching department links
    - Include default keys (no department links)
    - Superadmin can see all
    """
    rows = await conn.fetch(
        """
        WITH key_departments_data AS (
            SELECT
                pkr.key_id,
                ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id::text) as department_ids
            FROM setting_provider_keys_junction spk
            JOIN provider_keys_resource pkr ON pkr.id = spk.provider_keys_id
            JOIN setting_artifact s ON s.id = spk.setting_id
                AND EXISTS (
                    SELECT 1 FROM setting_flags_junction sf
                    JOIN flags_resource f ON sf.flags_id = f.id
                    WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND f.value = true
                )
            JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
            WHERE spk.active = true
            GROUP BY pkr.key_id
        )
        SELECT
            kr.id as key_id,
            kr.name,
            CASE
                WHEN LENGTH(kr.key) > 4 THEN LEFT(kr.key, 4) || '****'
                ELSE '****'
            END as key_masked,
            kr.description,
            kr.active,
            kdd.department_ids
        FROM keys_resource kr
        LEFT JOIN key_departments_data kdd ON kdd.key_id = kr.id
        WHERE
            EXISTS (
                SELECT 1 FROM setting_provider_keys_junction spk
                JOIN provider_keys_resource pkr ON pkr.id = spk.provider_keys_id
                JOIN setting_artifact s ON s.id = spk.setting_id
                    AND EXISTS (
                        SELECT 1 FROM setting_flags_junction sf
                        JOIN flags_resource f ON sf.flags_id = f.id
                        WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND f.value = true
                    )
                JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
                WHERE pkr.key_id = kr.id AND spk.active = true
                AND ds.department_id = ANY($1)
            )
            OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = kr.id)
            OR $2 = 'superadmin'
        ORDER BY kr.created_at DESC
        """,
        [UUID(str(d)) for d in user_department_ids] if user_department_ids else [],
        user_role or "member",
    )

    return [
        ListSettingApiKey(
            key_id=r["key_id"],
            name=r["name"],
            key_masked=r["key_masked"],
            description=r["description"],
            active=r["active"],
            department_ids=r["department_ids"],
        )
        for r in rows
    ]
