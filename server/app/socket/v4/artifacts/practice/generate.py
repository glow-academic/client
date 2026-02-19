"""Practice generation handler - creates attempt synchronously, then delegates to training_generate.

Flow:
1. Validate profile via find_profile_by_socket(sid)
2. SYNC step: Create attempt via create_attempt_v4() SQL
3. Invalidate cache tags ["attempt", "attempts"]
4. Emit practice_generation_started to client with attempt_id
5. Look up training context via SQL_ATTEMPT_CONTEXT query
6. Emit training_generate on internal bus with context
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.practice.types import (
    GeneratePracticePayload,
    PracticeGenerationErrorEvent,
    PracticeGenerationStartedEvent,
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


async def _practice_generate_impl(
    sid: str,
    payload: GeneratePracticePayload,
    profile_id: uuid.UUID,
) -> None:
    """Handle practice generation - create attempt, then delegate to training_generate."""
    try:
        # Step 1: Create attempt synchronously
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
                    "practice_generation_error",
                    PracticeGenerationErrorEvent(
                        message="Failed to create attempt",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            attempt_id = row.out_attempt_id

        # Step 2: Invalidate cache
        await invalidate_tags(["attempt", "attempts"])

        # Step 3: Emit practice_generation_started to client
        event = PracticeGenerationStartedEvent(
            attempt_id=str(attempt_id),
            training_entry_id=str(payload.training_entry_id),
        )
        await sio.emit(
            "practice_generation_started",
            event.model_dump(mode="json"),
            room=sid,
        )

        # Step 4: Look up training context
        async with get_db_connection() as conn:
            ctx = await conn.fetchrow(SQL_ATTEMPT_CONTEXT, attempt_id)

        if not ctx:
            logger.warning(f"No training context for attempt {attempt_id}")
            return

        # Step 5: Delegate to training_generate on internal bus
        resource_types = payload.resource_types or [
            "personas",
            "scenarios",
            "parameters",
            "fields",
        ]

        emit_data: dict[str, Any] = {
            "sid": sid,
            "training_entry_id": str(ctx["training_entry_id"]),
            "resource_types": resource_types,
            "save": payload.save,
            "attempt_id": str(attempt_id),
            "training_department_id": str(ctx["training_department_id"]),
        }

        if payload.draft_id:
            emit_data["draft_id"] = str(payload.draft_id)
        if payload.user_instructions:
            emit_data["user_instructions"] = payload.user_instructions

        await internal_sio.emit("training_generate", emit_data)

    except Exception as e:
        logger.exception(f"Error in practice_generate: {str(e)}")
        await sio.emit(
            "practice_generation_error",
            PracticeGenerationErrorEvent(
                message=f"Failed to start practice generation: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def practice_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle practice_generate event from client."""
    try:
        payload = GeneratePracticePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "practice_generation_error",
                PracticeGenerationErrorEvent(
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _practice_generate_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in practice_generate: {str(e)}")
        await sio.emit(
            "practice_generation_error",
            PracticeGenerationErrorEvent(
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("practice_generate")  # type: ignore
async def practice_generate_internal(data: dict[str, Any]) -> None:
    """Handle practice_generate from internal bus."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GeneratePracticePayload(**data)
        await _practice_generate_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Error in practice_generate_internal: {str(e)}")


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/practice/generate", response_model=dict[str, bool])
async def practice_generate_api(request: GeneratePracticePayload) -> dict[str, bool]:
    """Client-to-server event: Start practice generation."""
    return {"success": True}


@server_router.post("/practice_generation_started")
async def practice_generation_started_api(
    request: PracticeGenerationStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Practice generation started."""
    return {"success": True}
