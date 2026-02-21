"""Internal attempt_grade handler — owns grading preparation logic.

Handles: @internal_sio.on("attempt_grade")

Flow: Fetch attempt → resolve chat_id → prepare grade SQL → emit "generate"
to trigger LLM grading via the generation pipeline.
"""

import uuid
from typing import Any, cast

from app.api.v4.artifacts.attempt.get import get_attempt_websocket
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import (
    AttemptErrorData,
    AttemptGradeStartData,
    GenerateRequestData,
)
from app.sql.types import PrepareAttemptGradeSqlParams, PrepareAttemptGradeSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_PREPARE_GRADE = (
    "app/sql/v4/queries/generate/attempt/prepare_attempt_grade_complete.sql"
)

# Grade resource types
GRADE_RESOURCE_TYPES = [
    "feedbacks",
    "strengths",
    "improvements",
    "analyses",
    "highlights",
    "replacements",
]


@internal_sio.on("attempt_grade")  # type: ignore
async def attempt_grade_handler(data: dict[str, Any]) -> None:
    """Handle attempt_grade — prepare grade record, emit to generate pipeline."""
    sid = data.get("sid", "")
    if not sid:
        return

    # Resolve profile_id (passed from client, or fallback to socket lookup)
    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        attempt_id = uuid.UUID(str(data["attempt_id"]))
        chat_id = uuid.UUID(str(data["chat_id"])) if data.get("chat_id") else None
        resource_types = data.get("resource_types")
        user_instructions = data.get("user_instructions")
    except Exception as e:
        logger.exception(f"Invalid attempt_grade payload: {e}")
        return

    try:
        # Step 1: Fetch attempt data
        async with get_db_connection() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=attempt_id,
            )

        if not result.resources:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="Attempt not found or access denied",
                    chat_id=str(chat_id) if chat_id else None,
                ).model_dump(mode="json"),
            )
            return

        # Step 2: Resolve chat_id (from payload or first active chat in views)
        grade_chat_id = chat_id
        if not grade_chat_id and result.views and result.views.attempt_chat:
            grade_chat_id = result.views.attempt_chat[0].id

        if not grade_chat_id:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="No chat found for grading",
                ).model_dump(mode="json"),
            )
            return

        # Step 3: Resolve group_id
        existing_group_id = result.group_id
        if not existing_group_id:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="No group found for grading",
                    chat_id=str(grade_chat_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 4: Extract agent/model/provider from config
        result_config = result.config
        config_agents = result_config.agents or [] if result_config else []
        config_models = result_config.models or [] if result_config else []
        config_providers = result_config.providers or [] if result_config else []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource or not model_resource or not provider_resource:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="Missing agent/model/provider configuration",
                    chat_id=str(grade_chat_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 5: Prepare grade SQL (creates grade record + run)
        async with get_db_connection() as conn:
            grade_prepare_params = PrepareAttemptGradeSqlParams(
                p_profile_id=profile_id,
                p_group_id=existing_group_id,
                p_chat_id=grade_chat_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
            )
            grade_prepare_row = cast(
                PrepareAttemptGradeSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_PREPARE_GRADE, params=grade_prepare_params
                ),
            )

        if not grade_prepare_row or not grade_prepare_row.run_id:
            logger.error(
                f"Attempt grade preparation failed - "
                f"profile_id={profile_id}, attempt_id={attempt_id}"
            )
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="grade",
                    message="Failed to prepare grading",
                    chat_id=str(grade_chat_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 6: Emit grade_start to server layer
        await internal_sio.emit(
            "attempt_grade_start",
            AttemptGradeStartData(
                sid=sid,
                chat_id=str(grade_chat_id),
                grade_id=str(grade_prepare_row.grade_id)
                if grade_prepare_row.grade_id
                else None,
            ).model_dump(mode="json"),
        )

        # Step 7: Emit to generate pipeline (pre-created run_id skips prepare)
        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=str(profile_id),
                artifact_type="attempt",
                artifact_id=str(attempt_id),
                resource_types=resource_types or GRADE_RESOURCE_TYPES,
                user_instructions=user_instructions,
                save=True,
                attempt_id=str(attempt_id),
                run_id=str(grade_prepare_row.run_id),
                group_id=str(existing_group_id),
                chat_id=str(grade_chat_id),
                grade_id=str(grade_prepare_row.grade_id)
                if grade_prepare_row.grade_id
                else None,
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.grade.started",
                template="{{ actor.name }} started grading",
                context={"chat_id": str(grade_chat_id)},
                endpoint="/socket/v5/attempt/grade",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_grade: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="grade",
                message=f"Failed to start grading: {e}",
                chat_id=str(chat_id) if chat_id else None,
            ).model_dump(mode="json"),
        )
