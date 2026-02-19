"""Attempt lifecycle control plane.

Handles attempt_start event (client + internal). Dual-mode:
- Create mode (no attempt_id): Create attempt via SQL, emit attempt_started
- Next mode (has attempt_id): Check remaining scenarios, emit training_generate or attempt_ended
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptEndedEvent,
    AttemptStartedEvent,
    AttemptStartPayload,
    AttemptUnifiedErrorEvent,
)
from app.sql.types import (
    CreateAttemptSqlParams,
    CreateAttemptSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SHOULD_PROCEED = True

SQL_PATH_CREATE_ATTEMPT = (
    "app/sql/v4/queries/artifacts/attempt/create_attempt_complete.sql"
)

# SQL to look up training_entry_id and training_department_id from an attempt
SQL_ATTEMPT_CONTEXT = """
    SELECT
        COALESCE(pte.training_id, hte.training_id) AS training_entry_id,
        tbd.id AS training_department_id
    FROM attempt_entry a
    LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
    LEFT JOIN practice_training_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
    LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
    LEFT JOIN home_training_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
    LEFT JOIN training_department_entry tbd
      ON tbd.training_id = COALESCE(pte.training_id, hte.training_id) AND tbd.active = true
    WHERE a.id = $1
    LIMIT 1
"""

# SQL to count remaining scenarios (expected - already chatted)
SQL_REMAINING_SCENARIOS = """
    WITH attempt_training AS (
        SELECT COALESCE(pte.training_id, hte.training_id) AS training_id
        FROM attempt_entry a
        LEFT JOIN attempt_practice_entry apc ON apc.attempt_id = a.id AND apc.active = true
        LEFT JOIN practice_training_entry pte ON pte.practice_id = apc.practice_id AND pte.active = true
        LEFT JOIN attempt_home_entry ahc ON ahc.attempt_id = a.id AND ahc.active = true
        LEFT JOIN home_training_entry hte ON hte.home_id = ahc.home_id AND hte.active = true
        WHERE a.id = $1
    ),
    expected_scenarios AS (
        SELECT DISTINCT tsc.scenarios_id AS scenario_id
        FROM attempt_training at2
        JOIN training_scenarios_connection tsc ON tsc.training_id = at2.training_id AND tsc.active = true
    ),
    existing_scenarios AS (
        SELECT DISTINCT csc.scenarios_id
        FROM attempt_chat_entry c
        JOIN attempt_chat_scenarios_connection csc ON csc.chat_id = c.id AND csc.active = true
        WHERE c.attempt_id = $1 AND c.active = true
    )
    SELECT
        (SELECT COUNT(*) FROM expected_scenarios)::int AS total_scenarios,
        (SELECT COUNT(*) FROM existing_scenarios)::int AS completed_scenarios,
        (SELECT COUNT(*) FROM expected_scenarios es
         WHERE es.scenario_id NOT IN (SELECT scenarios_id FROM existing_scenarios))::int AS remaining_scenarios
"""


async def _attempt_start_impl(
    sid: str, payload: AttemptStartPayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt_start - create or proceed to next scenario."""
    try:
        if payload.attempt_id is None:
            # === CREATE MODE ===
            if not payload.training_entry_id:
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        type="start",
                        message="training_entry_id is required to create an attempt",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            async with get_db_connection() as conn:
                row = cast(
                    CreateAttemptSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH_CREATE_ATTEMPT,
                        params=CreateAttemptSqlParams(
                            p_profile_id=profile_id,
                            p_training_entry_id=payload.training_entry_id,
                            p_infinite_mode=payload.infinite_mode,
                        ),
                    ),
                )

                if not row or not row.out_attempt_id:
                    await sio.emit(
                        "attempt_error",
                        AttemptUnifiedErrorEvent(
                            type="start",
                            message="Failed to create attempt",
                        ).model_dump(mode="json"),
                        room=sid,
                    )
                    return

                attempt_id = row.out_attempt_id
                await invalidate_tags(["attempt", "attempts"])

            # Emit attempt_started to client
            event = AttemptStartedEvent(
                attempt_id=str(attempt_id),
                training_entry_id=str(payload.training_entry_id),
            )
            await sio.emit(
                "attempt_started",
                event.model_dump(mode="json"),
                room=sid,
            )

            if not SHOULD_PROCEED:
                return

            # Auto-proceed: look up context and emit training_generate
            async with get_db_connection() as conn:
                ctx = await conn.fetchrow(SQL_ATTEMPT_CONTEXT, attempt_id)

            if not ctx:
                logger.warning(f"No training bundle context for attempt {attempt_id}")
                return

            await _emit_training_generate(
                sid=sid,
                attempt_id=attempt_id,
                training_entry_id=payload.training_entry_id,
                training_department_id=ctx["training_department_id"],
                payload=payload,
            )

        else:
            # === NEXT MODE ===
            attempt_id = payload.attempt_id

            async with get_db_connection() as conn:
                # Look up context
                ctx = await conn.fetchrow(SQL_ATTEMPT_CONTEXT, attempt_id)
                if not ctx:
                    logger.warning(
                        f"No training bundle context for attempt {attempt_id}"
                    )
                    await sio.emit(
                        "attempt_error",
                        AttemptUnifiedErrorEvent(
                            type="start",
                            message="Attempt context not found",
                        ).model_dump(mode="json"),
                        room=sid,
                    )
                    return

                training_entry_id = ctx["training_entry_id"]
                training_department_id = ctx["training_department_id"]

                # Check remaining scenarios
                remaining = await conn.fetchrow(SQL_REMAINING_SCENARIOS, attempt_id)

            remaining_count = remaining["remaining_scenarios"] if remaining else 0

            if remaining_count > 0:
                # More scenarios to go — emit training_generate
                await _emit_training_generate(
                    sid=sid,
                    attempt_id=attempt_id,
                    training_entry_id=training_entry_id,
                    training_department_id=training_department_id,
                    payload=payload,
                )
            else:
                # All scenarios complete — emit attempt_ended
                event = AttemptEndedEvent(
                    attempt_id=str(attempt_id),
                    success=True,
                    all_scenarios_complete=True,
                    message="All scenarios completed",
                )
                await sio.emit(
                    "attempt_ended",
                    event.model_dump(mode="json"),
                    room=sid,
                )

    except Exception as e:
        logger.exception(f"Error in attempt_start: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                type="start",
                message=f"Failed to start attempt: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


async def _emit_training_generate(
    sid: str,
    attempt_id: uuid.UUID,
    training_entry_id: uuid.UUID,
    training_department_id: uuid.UUID,
    payload: AttemptStartPayload,
) -> None:
    """Emit training_generate internally with attempt context."""
    resource_types = payload.resource_types or [
        "personas",
        "scenarios",
        "parameters",
        "fields",
    ]

    emit_data: dict[str, Any] = {
        "sid": sid,
        "training_entry_id": str(training_entry_id),
        "resource_types": resource_types,
        "save": payload.save,
        "attempt_id": str(attempt_id),
        "training_department_id": str(training_department_id),
    }

    if payload.draft_id:
        emit_data["draft_id"] = str(payload.draft_id)
    if payload.user_instructions:
        emit_data["user_instructions"] = payload.user_instructions

    await internal_sio.emit("training_generate", emit_data)


@sio.event  # type: ignore
async def attempt_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_start event from client."""
    try:
        payload = AttemptStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    type="start",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_start_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_start: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                type="start",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_internal(data: dict[str, Any]) -> None:
    """Handle attempt_start from internal bus (auto-proceed)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptStartPayload(**data)
        await _attempt_start_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Error in attempt_start_internal: {str(e)}")


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/start", response_model=dict[str, bool])
async def attempt_start_api(request: AttemptStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start or proceed with an attempt."""
    return {"success": True}


@server_router.post("/attempt/started", response_model=dict[str, bool])
async def attempt_started_api(request: AttemptStartedEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt created."""
    return {"success": True}
