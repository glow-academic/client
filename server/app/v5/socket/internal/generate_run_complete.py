"""Handle generate_run_complete — canonical run completion handler.

Emitted by generate_artifact.py (text path) and audio events.py (audio path)
when a generation run finishes.

Steps:
1. Save assistant message (deduplicated) + record token counts
2. Multi-agent coordination (record_agent_complete)
3. If more agents pending → return
4. All agents finished: build resource_actions, auto-save, emit saved/complete, cleanup
5. Audio modality: re-emit "generate" for rate limit gate (next turn continuation)
"""

import uuid
from typing import Any

from app.v5.infra.storage.file_writer import write_text_file
from app.v5.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.v5.infra.websocket.generation_tracker import (
    cleanup_generation,
    record_agent_complete,
)
from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.v5.socket.internal.attempt.types import AttemptChatStartedData
from app.v5.socket.internal.generation_save_registry import save_artifact
from app.v5.socket.internal.generation_types import (
    GenerationCompleteData,
    GenerationSavedData,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/v5/sql/queries/messages/create_message_with_text_complete.sql"
)


@internal_sio.on("generate_run_complete")  # type: ignore
async def handle_run_complete(data: dict[str, Any]) -> None:
    """Handle run_complete for all artifact types and modalities."""
    sid = data.get("sid", "")
    if not sid:
        return

    run_id = data.get("run_id")
    group_id_str = data.get("group_id", "")
    modality = data.get("modality", "text")
    artifact_type = data.get("artifact_type", "unknown")

    logger.info(
        f"generate_run_complete - modality={modality}, group_id={group_id_str}, "
        f"input_tokens={data.get('input_text_tokens', 0)}, "
        f"output_tokens={data.get('output_text_tokens', 0)}"
    )

    # --- Audio continuation: re-enter rate limit gate for next turn ---
    if modality == "audio":
        if group_id_str:
            await internal_sio.emit(
                "generate",
                {
                    "sid": sid,
                    "artifact_types": data.get("artifact_types")
                    or [{"name": artifact_type, "operation": "get"}],
                    "group_id": group_id_str,
                    "metadata": data.get("metadata", {}),
                },
            )
        return

    # --- Text/call path: full run completion ---
    if not run_id:
        return

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
                    upload_id = await write_text_file(conn, None, assistant_output)
                    create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
                    await conn.fetchval(
                        create_message_sql,
                        uuid.UUID(run_id),
                        "assistant",
                        upload_id,
                        True,
                    )

            if input_tokens or output_tokens:
                await conn.execute(
                    """
                    INSERT INTO tokens_entry (run_id, input_tokens, output_tokens)
                    VALUES ($1, COALESCE($2, 0), COALESCE($3, 0))
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

    # Step 3: All agents finished
    artifact_id: str | None = None
    should_save = data.get("save", True)
    profile_id_str = await find_profile_by_socket(sid)

    # 3a: Build resource_actions from all_tool_results
    resource_actions: dict[str, Any] = {}
    for tr in all_tool_results:
        if isinstance(tr, dict):
            result = tr.get("result") if isinstance(tr.get("result"), dict) else tr
            rt = tr.get("resource_type") or result.get("resource_type")
            rid = tr.get("resource_id") or result.get("resource_id")
            if rt and rid:
                resource_actions[rt] = {"resource_id": rid}

    # 3a-chat: Inject _attempt_chat_id into resource_actions for chat saves
    metadata = data.get("metadata") or {}
    if artifact_type == "chat":
        attempt_chat_id_meta = metadata.get("attempt_chat_id")
        if attempt_chat_id_meta:
            resource_actions["_attempt_chat_id"] = attempt_chat_id_meta

    # 3b: Auto-save if applicable
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

    # 3c: Emit saved event (only if save happened)
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

    # 3d: Emit complete event
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

    # 3e: Special case — chat: emit attempt_chat_started
    if artifact_type == "chat":
        attempt_id_data = metadata.get("attempt_id")
        attempt_chat_id_data = metadata.get("attempt_chat_id")
        if should_save and attempt_id_data and attempt_chat_id_data:
            async with get_db_connection() as conn:
                await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
                await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")
            await invalidate_tags(["attempt", "attempts"])

            await internal_sio.emit(
                "attempt_chat_started",
                AttemptChatStartedData(
                    sid=sid,
                    attempt_id=attempt_id_data,
                    chat_id=attempt_chat_id_data,
                ).model_dump(mode="json"),
            )

    # 3f: Cleanup
    await cleanup_generation(run_id)
