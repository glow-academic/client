"""Internal attempt_start handler — creates a new attempt, then delegates to attempt_proceed.

Handles: @internal_sio.on("attempt_start")

Flow:
1. Resolve context inline from home_id / practice_id
2. Create attempt_entry
3. Emit attempt_proceed with resolved context
"""

from __future__ import annotations

import uuid
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptStartPayload
from app.socket.v5.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
    AttemptStartedData,
    GenerateRequestData,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# SQL to count remaining scenarios (expected from training - completed chats)
SQL_REMAINING_SCENARIOS = """
    WITH attempt_training AS (
        SELECT COALESCE(pte.chat_id, hte.chat_id) AS chat_id
        FROM attempt_entry a
        LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
        LEFT JOIN practice_chat_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
        LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
        LEFT JOIN home_chat_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
        WHERE a.id = $1
    ),
    expected_scenarios AS (
        SELECT DISTINCT tsc.scenarios_id AS scenario_id
        FROM attempt_training at2
        JOIN chat_scenarios_connection tsc ON tsc.chat_id = at2.chat_id AND tsc.active = true
    ),
    completed_chats AS (
        SELECT COUNT(*) AS cnt
        FROM attempt_chat_entry c
        WHERE c.attempt_id = $1 AND c.active = true
    )
    SELECT
        (SELECT COUNT(*) FROM expected_scenarios)::int AS total_scenarios,
        (SELECT cnt FROM completed_chats)::int AS completed_scenarios,
        (GREATEST((SELECT COUNT(*) FROM expected_scenarios) - (SELECT cnt FROM completed_chats), 0))::int AS remaining_scenarios
"""


SQL_PATH_CREATE_CHAT = (
    "app/sql/v4/queries/generate/attempt/create_attempt_chat_complete.sql"
)


async def _resolve_context_inline(
    conn: asyncpg.Connection,
    profile_id: UUID,
    payload: AttemptStartPayload,
) -> tuple[UUID, UUID, bool, UUID | None, UUID | None, UUID | None, UUID | None, UUID | None]:
    """Resolve all attempt context from home_id / practice_id in inline queries.

    Returns:
        (chat_entry_id, profiles_resource_id, is_practice,
         simulations_resource_id, cohorts_resource_id, departments_resource_id,
         roles_resource_id, parent_id)
    """
    is_practice = payload.practice_id is not None
    parent_id: UUID | None = payload.practice_id if is_practice else payload.home_id

    # 1. chat_entry_id — from bridge table
    if is_practice:
        chat_entry_id = await conn.fetchval(
            "SELECT chat_id FROM practice_chat_entry "
            "WHERE practice_id = $1 AND active = true "
            "ORDER BY created_at LIMIT 1",
            parent_id,
        )
    else:
        chat_entry_id = await conn.fetchval(
            "SELECT chat_id FROM home_chat_entry "
            "WHERE home_id = $1 AND active = true "
            "ORDER BY created_at LIMIT 1",
            parent_id,
        )
    if not chat_entry_id:
        raise ValueError(f"No chat entry for parent {parent_id}")

    # 2. profiles_resource_id — from profile junction
    profiles_resource_id = await conn.fetchval(
        "SELECT profiles_id FROM profile_profiles_junction "
        "WHERE profile_id = $1 AND active = true LIMIT 1",
        profile_id,
    )
    if not profiles_resource_id:
        raise ValueError(f"Profile resource not found for profile_id {profile_id}")

    # 3. roles_resource_id — optional
    roles_resource_id = await conn.fetchval(
        "SELECT role_id FROM profile_roles_junction "
        "WHERE profile_id = $1 AND active = true LIMIT 1",
        profile_id,
    )

    # 4. departments_resource_id — from parent connection
    if is_practice:
        departments_resource_id = await conn.fetchval(
            "SELECT departments_id FROM practice_departments_connection "
            "WHERE practice_id = $1 AND active = true LIMIT 1",
            parent_id,
        )
    else:
        departments_resource_id = await conn.fetchval(
            "SELECT departments_id FROM home_departments_connection "
            "WHERE home_id = $1 AND active = true LIMIT 1",
            parent_id,
        )

    # 5. simulations_resource_id — from parent connection
    if is_practice:
        simulations_resource_id = await conn.fetchval(
            "SELECT simulations_id FROM practice_simulations_connection "
            "WHERE practice_id = $1 AND active = true LIMIT 1",
            parent_id,
        )
    else:
        simulations_resource_id = await conn.fetchval(
            "SELECT simulations_id FROM home_simulations_connection "
            "WHERE home_id = $1 AND active = true LIMIT 1",
            parent_id,
        )

    # 6. cohorts_resource_id — from parent connection
    if is_practice:
        cohorts_resource_id = await conn.fetchval(
            "SELECT cohorts_id FROM practice_cohorts_connection "
            "WHERE practice_id = $1 AND active = true LIMIT 1",
            parent_id,
        )
    else:
        cohorts_resource_id = await conn.fetchval(
            "SELECT cohorts_id FROM home_cohorts_connection "
            "WHERE home_id = $1 AND active = true LIMIT 1",
            parent_id,
        )

    return (
        chat_entry_id,
        profiles_resource_id,
        is_practice,
        simulations_resource_id,
        cohorts_resource_id,
        departments_resource_id,
        roles_resource_id,
        parent_id,
    )


async def _link_attempt_chat(
    conn: asyncpg.Connection,
    profile_id: UUID,
    attempt_id: UUID,
    chat_resolved_id: UUID,
) -> UUID | None:
    """Create attempt_chat_entry linking attempt to chat_resolved, refresh MVs."""
    from typing import cast

    from app.sql.types import CreateAttemptChatSqlParams, CreateAttemptChatSqlRow

    chat_row = cast(
        CreateAttemptChatSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_CREATE_CHAT,
            params=CreateAttemptChatSqlParams(
                p_profile_id=profile_id,
                p_attempt_id=attempt_id,
                p_chat_resolved_id=chat_resolved_id,
            ),
        ),
    )

    if not chat_row or not chat_row.chat_id:
        return None

    await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
    await conn.execute("REFRESH MATERIALIZED VIEW chat_resolved_mv")
    await invalidate_tags(["attempt", "attempts"])

    return chat_row.chat_id


async def _emit_chat_generate(
    sid: str,
    profile_id: uuid.UUID,
    attempt_id: uuid.UUID,
    chat_entry_id: uuid.UUID,
    department_id: uuid.UUID,
    chat_resolved_id: uuid.UUID | None,
    draft_id: uuid.UUID | None = None,
    resource_types: list[str] | None = None,
    user_instructions: list[str] | None = None,
    save: bool = True,
) -> None:
    """Compose with generate by emitting to the internal bus."""
    resolved_resource_types = resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

    await internal_sio.emit(
        "generate",
        GenerateRequestData(
            sid=sid,
            profile_id=str(profile_id),
            artifact_type="chat",
            artifact_id=str(chat_entry_id),
            draft_id=str(draft_id) if draft_id else None,
            resource_types=resolved_resource_types,
            user_instructions=user_instructions,
            save=save,
            attempt_id=str(attempt_id),
            chat_resolved_id=str(chat_resolved_id) if chat_resolved_id else None,
        ).model_dump(mode="json"),
    )


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_handler(data: dict[str, Any]) -> None:
    """Handle attempt_start — create a new attempt, then emit attempt_proceed."""
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptStartPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_start payload: {e}")
        return

    try:
        # Step 1: Resolve all context inline from home_id / practice_id
        async with get_db_connection() as conn:
            (
                chat_entry_id,
                profiles_resource_id,
                is_practice,
                simulations_resource_id,
                cohorts_resource_id,
                departments_resource_id,
                roles_resource_id,
                parent_id,
            ) = await _resolve_context_inline(conn, profile_id, payload)

        # Step 2: Create attempt (inline — one INSERT per table)
        async with get_db_connection() as conn:
            # 2a. attempt_entry
            attempt_id = await conn.fetchval(
                "INSERT INTO attempt_entry (created_at, updated_at, practice, infinite_mode) "
                "VALUES (NOW(), NOW(), $1, $2) RETURNING id",
                is_practice,
                payload.infinite_mode,
            )
            if not attempt_id:
                raise ValueError("Failed to create attempt entry")

            # 2b. Parent bridge (home or practice)
            if payload.home_id:
                await conn.execute(
                    "INSERT INTO attempt_home_entry (attempt_id, home_id) VALUES ($1, $2)",
                    attempt_id, payload.home_id,
                )
            else:
                await conn.execute(
                    "INSERT INTO attempt_practice_entry (attempt_id, practice_id) VALUES ($1, $2)",
                    attempt_id, payload.practice_id,
                )

            # 2c. Required connections
            await conn.execute(
                "INSERT INTO attempt_simulations_connection (simulations_id, attempt_id, active) "
                "VALUES ($1, $2, true) ON CONFLICT (attempt_id, simulations_id) DO NOTHING",
                simulations_resource_id, attempt_id,
            )
            await conn.execute(
                "INSERT INTO attempt_profiles_connection (profiles_id, attempt_id, active) "
                "VALUES ($1, $2, true) ON CONFLICT (attempt_id, profiles_id) DO NOTHING",
                profiles_resource_id, attempt_id,
            )

            # 2d. Optional connections
            if cohorts_resource_id:
                await conn.execute(
                    "INSERT INTO attempt_cohorts_connection (cohorts_id, attempt_id, active) "
                    "VALUES ($1, $2, true) ON CONFLICT (attempt_id, cohorts_id) DO NOTHING",
                    cohorts_resource_id, attempt_id,
                )
            if departments_resource_id:
                await conn.execute(
                    "INSERT INTO attempt_departments_connection (departments_id, attempt_id, active) "
                    "VALUES ($1, $2, true) ON CONFLICT (attempt_id, departments_id) DO NOTHING",
                    departments_resource_id, attempt_id,
                )
            if roles_resource_id:
                await conn.execute(
                    "INSERT INTO attempt_roles_connection (roles_id, attempt_id, active) "
                    "VALUES ($1, $2, true) ON CONFLICT (attempt_id, roles_id) DO NOTHING",
                    roles_resource_id, attempt_id,
                )

            # 2e. Refresh MV so attempt is immediately visible
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
            await invalidate_tags(["attempt", "attempts"])

        # Step 3: Get department_id — if missing, emit attempt_started (user picks)
        if not departments_resource_id:
            logger.warning(f"No department_id in context for attempt {attempt_id}")
            await internal_sio.emit(
                "attempt_started",
                AttemptStartedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    chat_entry_id=str(chat_entry_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 4: Delegate to attempt_proceed
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                profile_id=str(profile_id),
                attempt_id=str(attempt_id),
                chat_entry_id=str(chat_entry_id),
                department_id=str(departments_resource_id),
                force_proceed=False,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="start",
                message=f"Failed to start attempt: {e}",
            ).model_dump(mode="json"),
        )
