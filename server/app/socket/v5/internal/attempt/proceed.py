"""Internal attempt_proceed handler — shared core logic for starting a chat scenario.

Handles: @internal_sio.on("attempt_proceed")

Both attempt_start and attempt_next emit attempt_proceed with just attempt_id.
This handler resolves all context via a single SQL call, then:

1. Check if all chats are done → emit attempt_ended
2. Check generate_* flags on next chat_entry
3. If no generation needed → create attempt_chat_entry + copy links → emit attempt_chat_started
4. If generation needed → emit generate(resource_types=[true flags]) → on complete, fill remaining links
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.helpers import (
    emit_chat_generate,
    link_attempt_chat,
)
from app.socket.v5.internal.attempt.types import (
    AttemptChatStartedData,
    AttemptEndedData,
    AttemptErrorData,
    AttemptProceedData,
    AttemptStartedData,
)
from app.sql.types import (
    GetAttemptProceedContextSqlParams,
    GetAttemptProceedContextSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_PROCEED_CONTEXT = (
    "app/sql/v4/queries/generate/attempt/get_attempt_proceed_context_complete.sql"
)

# Will be replaced with real logic (e.g. check training config flags)
SHOULD_PROCEED = False

# Map generate_* flag names to resource_types for the generate pipeline
GENERATE_FLAG_TO_RESOURCE = {
    "generate_problem_statements": "problem_statements",
    "generate_objectives": "objectives",
    "generate_videos": "videos",
    "generate_images": "images",
    "generate_questions": "questions",
    "generate_names": "names",
    "generate_descriptions": "descriptions",
    "generate_personas": "personas",
    "generate_documents": "documents",
    "generate_options": "options",
    "generate_parameter_fields": "parameter_fields",
}


@internal_sio.on("attempt_proceed")  # type: ignore
async def attempt_proceed_handler(data: dict[str, Any]) -> None:
    """Shared core: resolve context → check done → generate or copy → emit."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        payload = AttemptProceedData(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_proceed payload: {e}")
        return

    # Resolve profile_id from socket
    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        logger.warning("No profile_id for attempt_proceed")
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        attempt_id = uuid.UUID(payload.attempt_id)
        draft_id = uuid.UUID(payload.draft_id) if payload.draft_id else None
        should_proceed = payload.force_proceed or SHOULD_PROCEED

        # Step 1: Get all context in one SQL call
        async with get_db_connection() as conn:
            row = cast(
                GetAttemptProceedContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_PROCEED_CONTEXT,
                    params=GetAttemptProceedContextSqlParams(
                        p_attempt_id=attempt_id,
                        p_profile_id=profile_id,
                    ),
                ),
            )

        if not row or not row.items:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="proceed",
                    message="Failed to resolve attempt context",
                ).model_dump(mode="json"),
            )
            return

        ctx = row.items[0]

        # Step 2: Check if all chats are done
        if ctx.chat_entry_id is None or (
            ctx.completed_count is not None
            and ctx.num_chats is not None
            and ctx.completed_count >= ctx.num_chats
        ):
            await internal_sio.emit(
                "attempt_ended",
                AttemptEndedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    success=True,
                    all_scenarios_complete=True,
                    message="All scenarios completed",
                ).model_dump(mode="json"),
            )
            return

        chat_entry_id = ctx.chat_entry_id
        department_id = ctx.department_id

        if not department_id:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="proceed",
                    message="No department could be resolved for this chat",
                ).model_dump(mode="json"),
            )
            return

        # Step 3: Determine which resources need generation
        resource_types_to_generate: list[str] = []
        for flag_name, resource_type in GENERATE_FLAG_TO_RESOURCE.items():
            if getattr(ctx, flag_name, False):
                resource_types_to_generate.append(resource_type)

        needs_generation = len(resource_types_to_generate) > 0

        if not needs_generation:
            # TODO: Create attempt_chat_entry directly + copy all links
            # For now, fall through to prepare_training_start path
            from app.api.v4.resources.training.context import (
                prepare_training_start_internal,
            )

            async with get_db_connection() as conn:
                attempt_chat_id, _scenario_id = await prepare_training_start_internal(
                    conn,
                    profile_id=profile_id,
                    chat_entry_id=chat_entry_id,
                    department_id=department_id,
                    draft_id=draft_id,
                )

            if not attempt_chat_id:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="proceed",
                        message="Failed to create resolved chat entry",
                    ).model_dump(mode="json"),
                )
                return

            async with get_db_connection() as conn:
                chat_id = await link_attempt_chat(
                    conn, profile_id, attempt_id, attempt_chat_id
                )

            if chat_id:
                await internal_sio.emit(
                    "attempt_chat_started",
                    AttemptChatStartedData(
                        sid=sid,
                        attempt_id=str(attempt_id),
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
        elif should_proceed:
            # Needs generation and should auto-proceed
            from app.api.v4.resources.training.context import (
                prepare_training_start_internal,
            )

            async with get_db_connection() as conn:
                attempt_chat_id, _scenario_id = await prepare_training_start_internal(
                    conn,
                    profile_id=profile_id,
                    chat_entry_id=chat_entry_id,
                    department_id=department_id,
                    draft_id=draft_id,
                )

            if not attempt_chat_id:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="proceed",
                        message="Failed to create resolved chat entry",
                    ).model_dump(mode="json"),
                )
                return

            await emit_chat_generate(
                sid=sid,
                profile_id=profile_id,
                attempt_id=attempt_id,
                chat_entry_id=chat_entry_id,
                department_id=department_id,
                attempt_chat_id=attempt_chat_id,
                draft_id=draft_id,
                resource_types=resource_types_to_generate,
            )
        else:
            # User decides — emit attempt_started so they see lobby
            await internal_sio.emit(
                "attempt_started",
                AttemptStartedData(
                    sid=sid,
                    attempt_id=str(attempt_id),
                    chat_entry_id=str(chat_entry_id),
                ).model_dump(mode="json"),
            )

    except Exception as e:
        logger.exception(f"Error in attempt_proceed: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="proceed",
                message=f"Failed to proceed: {e}",
            ).model_dump(mode="json"),
        )
