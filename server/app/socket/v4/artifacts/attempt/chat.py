"""Attempt chat creation handler.

Listens to the internal attempt_chat event and completes the training start flow:
1. Creates chat entry + config snapshots via SQL
2. Refreshes MVs
3. Emits training_started to client

This handler is the final step in both the generation and no-generation paths
of training start. It is always invoked via internal event from either
training/start.py or training/complete.py.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.training.types import TrainingStartedEvent
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    CreateAttemptChatSqlParams,
    CreateAttemptChatSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH_CREATE_CHAT = (
    "app/sql/v4/queries/generate/attempt/create_attempt_chat_complete.sql"
)


@internal_sio.on("attempt_chat")  # type: ignore
async def handle_attempt_chat(data: dict[str, Any]) -> None:
    """Handle attempt_chat internal event - create chat and emit training_started.

    Receives:
        sid: Socket ID for routing responses
        profile_id: Profile UUID string
        attempt_id: Attempt UUID string
        training_bundle_department_id: Training bundle department UUID string
        simulation_id: Simulation UUID string (passthrough for client event)
        scenario_id: Scenario UUID string (passthrough for client event)
        scenario_data: Scenario data dict (passthrough for client event)
    """
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        profile_id = uuid.UUID(data["profile_id"])
        attempt_id = uuid.UUID(data["attempt_id"])
        training_bundle_department_id = uuid.UUID(data["training_bundle_department_id"])
        simulation_id = data["simulation_id"]
        scenario_id = data.get("scenario_id")
        scenario_data = data.get("scenario_data")

        async with get_db_connection() as conn:
            # Step 1: Create chat + config snapshots
            chat_params = CreateAttemptChatSqlParams(
                p_profile_id=profile_id,
                p_attempt_id=attempt_id,
                p_training_bundle_department_id=training_bundle_department_id,
            )

            chat_row = cast(
                CreateAttemptChatSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CREATE_CHAT, params=chat_params),
            )

            if not chat_row or not chat_row.chat_id:
                logger.error(
                    f"Attempt chat creation failed - "
                    f"attempt_id={attempt_id}, "
                    f"training_bundle_department_id={training_bundle_department_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create chat for attempt",
                        artifact_type="training",
                        group_id=None,
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            # Step 2: Refresh MVs so attempt is immediately visible
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Step 3: Emit training_started event to client
            started_event = TrainingStartedEvent(
                simulation_id=str(simulation_id),
                attempt_id=str(attempt_id),
                chat_id=str(chat_row.chat_id),
                scenario_id=str(scenario_id) if scenario_id else None,
                scenario_data=scenario_data,
            )

            await sio.emit(
                "training_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            logger.info(
                f"Attempt chat created - "
                f"attempt_id={attempt_id}, chat_id={chat_row.chat_id}, "
                f"scenario_id={scenario_id}"
            )

    except Exception as e:
        logger.exception(f"Failed to create attempt chat: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to create attempt chat: {str(e)}",
                artifact_type="training",
                group_id=None,
                resource_type="training",
            ),
            sid=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/chat", response_model=dict[str, bool])
async def attempt_chat_api(request: dict[str, Any]) -> dict[str, bool]:
    """Internal event: Create attempt chat (not sent to client)."""
    return {"success": True}
