"""Training simulation complete handler.

Listens to AI generation completion events and completes the training start flow:
1. Fetch fresh scenario data from DB
2. Create attempt + chat entries
3. Emit training_started to client

This handler finishes the flow that start.py began when generation was needed.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.training.get import get_training_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.training.types import TrainingStartedEvent
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    PrepareTrainingStartSqlParams,
    PrepareTrainingStartSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

# SQL paths
SQL_PATH_PREPARE_START = (
    "app/sql/v4/queries/generate/training/prepare_training_start_complete.sql"
)


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_training_complete(data: dict[str, Any]) -> None:
    """Handle generate_*_complete events - complete the training flow.

    When generation completes, this handler:
    1. Fetches fresh scenario data from DB
    2. Creates attempt + chat entries
    3. Emits training_started to client
    """
    # Filter by artifact_type (early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "training":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    # Verify profile still connected
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    training_bundle_entry_id_str = data.get("training_bundle_entry_id")
    department_id_str = data.get("department_id")
    draft_id_str = data.get("draft_id")

    if not training_bundle_entry_id_str or not department_id_str:
        logger.error("Training complete missing training bundle context")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message="Training generation failed: missing context",
                artifact_type="training",
                group_id=data.get("group_id"),
                resource_type="training",
            ),
            sid=sid,
        )
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        training_bundle_entry_id = uuid.UUID(training_bundle_entry_id_str)
        department_id = uuid.UUID(department_id_str)
        draft_id = uuid.UUID(draft_id_str) if draft_id_str else None

        async with get_db_connection() as conn:
            # Step 1: Fetch fresh scenario data from DB
            training_ws = await get_training_websocket(
                conn=conn,
                profile_id=profile_id,
                training_bundle_entry_id=training_bundle_entry_id,
                department_id=department_id,
                draft_id=draft_id,
            )
            context_row = training_ws.resources

            if not context_row.simulation_id:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Missing simulation scope for selected training bundle",
                        artifact_type="training",
                        group_id=data.get("group_id"),
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            # Step 2: Create attempt + chat entries
            prepare_params = PrepareTrainingStartSqlParams(
                p_profile_id=profile_id,
                p_training_bundle_entry_id=training_bundle_entry_id,
                p_department_id=department_id,
                p_draft_id=draft_id,
            )

            prepare_row = cast(
                PrepareTrainingStartSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_PREPARE_START, params=prepare_params
                ),
            )

            if not prepare_row or not prepare_row.attempt_id:
                logger.error(
                    f"Training complete preparation failed - "
                    f"profile_id={profile_id}, training_bundle_entry_id={training_bundle_entry_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create training attempt after generation",
                        artifact_type="training",
                        group_id=data.get("group_id"),
                        resource_type="training",
                    ),
                    sid=sid,
                )
                return

            # Step 3: Build scenario data with fresh values from DB
            scenario_data = None
            if context_row.scenario_id:
                scenario_data = {
                    "problem_statement": context_row.problem_statement,
                    "objectives": context_row.objectives,
                    "persona": context_row.persona,
                    "video_ids": context_row.video_ids,
                    "image_ids": context_row.image_ids,
                }

            # Step 4: Emit training_started event
            started_event = TrainingStartedEvent(
                simulation_id=str(context_row.simulation_id),
                attempt_id=str(prepare_row.attempt_id),
                chat_id=str(prepare_row.chat_id),
                scenario_id=str(prepare_row.scenario_id)
                if prepare_row.scenario_id
                else None,
                scenario_data=scenario_data,
            )

            # Step 5: Refresh MVs so attempt is immediately visible
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Step 6: Emit training_started event (after MVs refreshed)
            await sio.emit(
                "training_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            logger.info(
                f"Training session started (after generation) - "
                f"profile_id={profile_id}, simulation_id={context_row.simulation_id}, "
                f"attempt_id={prepare_row.attempt_id}, chat_id={prepare_row.chat_id}"
            )

    except Exception as e:
        logger.exception(f"Failed to complete training session: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to complete training: {str(e)}",
                artifact_type="training",
                group_id=data.get("group_id"),
                resource_type="training",
            ),
            sid=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/training/complete", response_model=dict[str, bool])
async def training_complete_api(request: dict[str, Any]) -> dict[str, bool]:
    """Internal event: Training generation completed (not sent to client)."""
    return {"success": True}
