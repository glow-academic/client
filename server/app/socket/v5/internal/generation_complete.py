"""Handle run_complete events — the main completion handler.

Replaces ALL 33 v4 complete.py files. Steps:
1. Save assistant message (deduplicated) + update token counts on runs_entry
2. record_agent_complete → (is_complete, all_tool_results)
3. If NOT is_complete → return (more agents pending)
4. If is_complete: build resource_actions, auto-save, emit saved/complete, cleanup
"""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.generation_tracker import (
    cleanup_generation,
    record_agent_complete,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptChatRequestData
from app.socket.v5.internal.generation_save_registry import save_artifact
from app.socket.v5.internal.generation_types import (
    GenerationCompleteData,
    GenerationSavedData,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_run_complete(data: dict[str, Any]) -> None:
    """Handle run_complete for all artifact types."""
    event_type = data.get("event_type")
    if event_type != "run_complete":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    run_id = data.get("run_id")
    if not run_id:
        return

    artifact_type = data.get("artifact_type", "unknown")
    group_id_str = data.get("group_id")
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)

    # Step 1: Save assistant message (deduplicated) + update token counts
    try:
        async with get_db_connection() as conn:
            if assistant_output:
                existing = await conn.fetchval(
                    """
                    SELECT id FROM messages_entry
                    WHERE run_id = $1 AND role = 'assistant'::message_type
                    LIMIT 1
                    """,
                    uuid.UUID(run_id),
                )
                if not existing:
                    create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
                    await conn.fetchval(
                        create_message_sql,
                        uuid.UUID(run_id),
                        "assistant",
                        assistant_output,
                        True,
                    )

            if input_tokens or output_tokens:
                await conn.execute(
                    """
                    UPDATE runs_entry
                    SET input_tokens = COALESCE($2, input_tokens),
                        output_tokens = COALESCE($3, output_tokens)
                    WHERE id = $1
                    """,
                    uuid.UUID(run_id),
                    input_tokens,
                    output_tokens,
                )
    except Exception as e:
        logger.exception(f"Failed to save run_complete for {artifact_type}: {e}")

    # Step 2: Multi-agent coordination
    tool_results = data.get("tool_results") or []
    is_complete, all_tool_results = await record_agent_complete(run_id, tool_results)

    if not is_complete:
        return  # More agents pending

    # Step 4: All agents finished
    artifact_id: str | None = None
    should_save = data.get("save", True)
    profile_id_str = await find_profile_by_socket(sid)

    # 4a: Build resource_actions from all_tool_results
    resource_actions: dict[str, Any] = {}
    for tr in all_tool_results:
        if isinstance(tr, dict):
            rt = tr.get("resource_type")
            rid = tr.get("resource_id")
            if rt and rid:
                resource_actions[rt] = {"resource_id": rid}

    # 4b: Auto-save if applicable
    if should_save and profile_id_str and group_id_str:
        try:
            profile_id = uuid.UUID(profile_id_str)
            group_id = uuid.UUID(group_id_str)

            async with get_db_connection() as conn:
                saved_id = await save_artifact(
                    artifact_type=artifact_type,
                    conn=conn,
                    profile_id=profile_id,
                    group_id=group_id,
                    resource_actions=resource_actions,
                )
                if saved_id:
                    artifact_id = str(saved_id)
        except Exception as e:
            logger.exception(f"Failed to auto-save {artifact_type}: {e}")

    # 4c: Emit saved event (only if save happened)
    if artifact_id:
        await internal_sio.emit(
            "generation_channel",
            GenerationSavedData(
                sid=sid,
                artifact_type=artifact_type,
                group_id=group_id_str or "",
                run_id=run_id,
                artifact_id=artifact_id,
            ).model_dump(mode="json"),
        )

    # 4d: Emit complete event
    await internal_sio.emit(
        "generation_channel",
        GenerationCompleteData(
            sid=sid,
            artifact_type=artifact_type,
            group_id=group_id_str or "",
            run_id=run_id,
            success=True,
            message=f"{artifact_type.capitalize()} generation completed",
            artifact_id=artifact_id,
            resource_actions=resource_actions,
        ).model_dump(mode="json"),
    )

    # 4e: Special case — chat emits attempt_chat after completion
    if artifact_type == "chat":
        metadata = data.get("metadata") or {}
        attempt_id_data = metadata.get("attempt_id")
        training_department_id_data = metadata.get("training_department_id")
        if (
            should_save
            and profile_id_str
            and attempt_id_data
            and training_department_id_data
        ):
            await internal_sio.emit(
                "attempt_chat",
                AttemptChatRequestData(
                    sid=sid,
                    attempt_id=attempt_id_data,
                    training_department_id=training_department_id_data,
                    profile_id=profile_id_str,
                ).model_dump(mode="json"),
            )

    # 4f: Cleanup
    await cleanup_generation(run_id)
