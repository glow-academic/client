"""Internal attempt_start handler — creates a new attempt and kicks off first chat.

Handles: @internal_sio.on("attempt_start")

Flow:
1. Resolve training context, create attempt_entry
2. Call prepare_training_start (creates chat_resolved_entry if missing)
3. Check if resolved entry needs generation
4. If ready: link attempt_chat_entry, emit attempt_started, proceed
5. If needs generation + SHOULD_PROCEED: auto-generate (emit generate save=True)
6. If needs generation + !SHOULD_PROCEED: emit attempt_started (user sees Next/Customize)
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.resources.training.context import (
    check_resolved_needs_generation,
    get_training_attempt_context_internal,
    prepare_training_start_internal,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptStartPayload
from app.socket.v5.internal.attempt.types import (
    AttemptChatStartedData,
    AttemptErrorData,
    AttemptStartedData,
    GenerateRequestData,
)
from app.sql.types import CreateAttemptSqlParams, CreateAttemptSqlRow
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

if TYPE_CHECKING:
    from app.api.v4.resources.training.context import TrainingAttemptContext

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Will be replaced with real logic (e.g. check training config flags)
SHOULD_PROCEED = False

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


SQL_PATH_CREATE_ATTEMPT = (
    "app/sql/v4/queries/artifacts/attempt/create_attempt_complete.sql"
)

SQL_PATH_CREATE_CHAT = (
    "app/sql/v4/queries/generate/attempt/create_attempt_chat_complete.sql"
)


async def create_attempt_with_context_internal(
    conn: asyncpg.Connection,
    context: TrainingAttemptContext,
    infinite_mode: bool = False,
) -> UUID:
    """Create attempt entry using pre-resolved training context.

    Used by socket handlers (home/practice/attempt).
    Returns the new attempt_id.
    """
    row = cast(
        CreateAttemptSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_CREATE_ATTEMPT,
            params=CreateAttemptSqlParams(
                p_practice=context.is_practice,
                p_infinite_mode=infinite_mode,
                p_practice_id=context.practice_id,
                p_home_id=context.home_id,
                p_simulations_resource_id=context.simulations_resource_id,
                p_profiles_resource_id=context.profiles_resource_id,
                p_cohorts_resource_id=context.cohorts_resource_id,
                p_departments_resource_id=context.departments_resource_id,
                p_roles_resource_id=context.roles_resource_id,
            ),
        ),
    )

    if not row or not row.out_attempt_id:
        raise ValueError("Failed to create attempt entry")

    await invalidate_tags(["attempt", "attempts"])

    return row.out_attempt_id


async def _link_attempt_chat(
    conn: asyncpg.Connection,
    profile_id: UUID,
    attempt_id: UUID,
    chat_resolved_id: UUID,
) -> UUID | None:
    """Create attempt_chat_entry linking attempt to chat_resolved, refresh MVs."""
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
    await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")
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
    """Handle attempt_start — create a new attempt."""
    sid = data.get("sid", "")
    if not sid:
        return

    # Resolve profile_id (passed from client, or fallback to socket lookup)
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
        chat_entry_id = payload.chat_entry_id

        # Step 1: Resolve training context (cached)
        async with get_db_connection() as conn:
            ctx = await get_training_attempt_context_internal(
                conn, profile_id, chat_entry_id
            )

        # Step 2: Create attempt with pre-resolved context
        async with get_db_connection() as conn:
            attempt_id = await create_attempt_with_context_internal(
                conn, context=ctx, infinite_mode=payload.infinite_mode
            )

        # Step 3: Get department_id from context and call prepare_training_start
        department_id = ctx.departments_resource_id
        if not department_id:
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

        async with get_db_connection() as conn:
            chat_resolved_id, scenario_id = await prepare_training_start_internal(
                conn,
                profile_id=profile_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
            )

        if not chat_resolved_id:
            logger.warning(
                f"prepare_training_start returned no chat_resolved_id for {chat_entry_id}"
            )
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="start",
                    message="Failed to resolve training context",
                ).model_dump(mode="json"),
            )
            return

        # Step 4: Check if resolved entry needs generation
        async with get_db_connection() as conn:
            needs_generation = await check_resolved_needs_generation(
                conn, chat_resolved_id
            )

        if not needs_generation:
            # Resources already populated — link and proceed immediately
            async with get_db_connection() as conn:
                chat_id = await _link_attempt_chat(
                    conn, profile_id, attempt_id, chat_resolved_id
                )

            # Emit attempt_started to client
            await internal_sio.emit(
                "attempt_started",
                AttemptStartedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    chat_entry_id=str(chat_entry_id),
                ).model_dump(mode="json"),
            )

            if chat_id:
                # Emit attempt_chat_started for the linked chat
                await internal_sio.emit(
                    "attempt_chat_started",
                    AttemptChatStartedData(
                        sid=sid,
                        attempt_id=str(attempt_id),
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
        else:
            # Needs generation
            if SHOULD_PROCEED:
                # Auto-generate: emit generate with save=True
                # Do NOT emit attempt_started yet — generation_complete will handle it
                await _emit_chat_generate(
                    sid=sid,
                    profile_id=profile_id,
                    attempt_id=attempt_id,
                    chat_entry_id=chat_entry_id,
                    department_id=department_id,
                    chat_resolved_id=chat_resolved_id,
                )
            else:
                # User decides — emit attempt_started so they see Next/Customize
                await internal_sio.emit(
                    "attempt_started",
                    AttemptStartedData(
                        sid=sid,
                        attempt_id=str(attempt_id),
                        chat_entry_id=str(chat_entry_id),
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
