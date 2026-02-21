"""Attempt grade handler.

Handles: attempt_grade — trigger grading for an attempt chat.

Registered on both @sio.event (client) and @internal_sio.on (internal bus)
so that attempt_end can compose by emitting attempt_grade internally.

Flow: Fetch → resolve chat_id → prepare SQL → compose with _generate_impl.
"""

import uuid
from typing import Any, cast

from app.api.v4.artifacts.attempt.get import get_attempt_websocket
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.generate import _generate_impl
from app.socket.v5.client.types import (
    AttemptErrorEvent,
    AttemptGradePayload,
    GeneratePayload,
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


async def _attempt_grade_impl(
    sid: str,
    attempt_id: uuid.UUID,
    chat_id: uuid.UUID | None,
    profile_id: uuid.UUID,
    resource_types: list[str] | None = None,
    user_instructions: list[str] | None = None,
) -> None:
    """Handle attempt_grade — prepare grade record, compose with generation."""
    try:
        # Step 1: Fetch attempt data
        async with get_db_connection() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=attempt_id,
            )

        if not result.resources:
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    chat_id=str(chat_id) if chat_id else None,
                    type="grade",
                    message="Attempt not found or access denied",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 2: Resolve chat_id (from payload or first active chat in views)
        grade_chat_id = chat_id
        if not grade_chat_id and result.views and result.views.attempt_chat:
            grade_chat_id = result.views.attempt_chat[0].id

        if not grade_chat_id:
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    type="grade",
                    message="No chat found for grading",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 3: Resolve group_id
        existing_group_id = result.group_id
        if not existing_group_id:
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    chat_id=str(grade_chat_id),
                    type="grade",
                    message="No group found for grading",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 4: Extract agent/model/provider resource IDs
        config_agents = result.resources.config_agents or []
        config_models = result.resources.config_models or []
        config_providers = result.resources.config_providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource or not model_resource or not provider_resource:
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    chat_id=str(grade_chat_id),
                    type="grade",
                    message="Missing agent/model/provider configuration",
                ).model_dump(mode="json"),
                room=sid,
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
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    chat_id=str(grade_chat_id),
                    type="grade",
                    message="Failed to prepare grading",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # Step 6: Compose with _generate_impl (pre-created run_id skips prepare)
        generate_payload = GeneratePayload(
            artifact_type="attempt",
            artifact_id=attempt_id,
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
        )

        await _generate_impl(sid, generate_payload, profile_id)

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
        await sio.emit(
            "attempt_error",
            AttemptErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
                type="grade",
                message=f"Failed to start grading: {e}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_grade(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_grade event from client."""
    try:
        payload = AttemptGradePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptErrorEvent(
                    type="grade",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_grade_impl(
            sid=sid,
            attempt_id=payload.attempt_id,
            chat_id=payload.chat_id,
            profile_id=profile_id,
            resource_types=payload.resource_types,
            user_instructions=payload.user_instructions,
        )

    except Exception as e:
        logger.exception(f"Invalid request in attempt_grade: {e}")
        await sio.emit(
            "attempt_error",
            AttemptErrorEvent(
                type="grade",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("attempt_grade")  # type: ignore
async def attempt_grade_internal(data: dict[str, Any]) -> None:
    """Handle attempt_grade from internal bus (e.g. from attempt_end)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        attempt_id = uuid.UUID(str(data["attempt_id"]))
        chat_id = uuid.UUID(str(data["chat_id"])) if data.get("chat_id") else None

        await _attempt_grade_impl(
            sid=sid,
            attempt_id=attempt_id,
            chat_id=chat_id,
            profile_id=profile_id,
        )

    except Exception as e:
        logger.exception(f"Error in attempt_grade_internal: {e}")
