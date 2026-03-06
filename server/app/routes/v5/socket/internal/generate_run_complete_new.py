"""Run completion handler (new) — uses new tracker + aggregates entries.

Replaces generate_run_complete.py.

Differences from generate_run_complete.py:
  - session_id, profile_id, group_id always in data (propagated from prepare → artifact)
  - Uses persist_run_message for assistant message persistence (with session_id)
  - Uses new run_tracker (record_agent_done, cleanup_run) with DI redis
  - Uses aggregate_tool_results which extracts both resource AND entry actions
  - Uses db_helpers for extracted SQL
  - Uses socket_event for event collection

GAPs / TODOs:
  - TODO: Pass entry_actions to save_artifact (currently only resource_actions used).
  - TODO: Chat special case (MV refresh + invalidate + attempt_chat_started) stays
          as-is. Should be extracted to a post-save hook.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.persist_run_message import persist_run_message
from app.routes.v5.tools.entries.tokens.create import create_token
from app.infra.websocket.run_tracker import cleanup_run, record_agent_done
from app.infra.websocket.socket_event import SocketEvent, flush_events, internal_event
from app.routes.v5.socket.internal.attempt.types import AttemptChatStartedData
from app.routes.v5.socket.internal.generation_save_registry import save_artifact
from app.routes.v5.socket.internal.generation_types import (
    GenerationCompleteData,
    GenerationSavedData,
)
from app.routes.v5.socket.internal.prepare_pipeline import aggregate_tool_results
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


# NOTE: Not registered as @internal_sio.on("generate_run_complete") yet.
# To activate: import and swap registration.
async def handle_run_complete_new(data: dict[str, Any]) -> None:
    """Handle run_complete — new version with tracker + entry aggregation.

    Expects session_id, profile_id, group_id in data
    (propagated from prepare → generate_artifact → here).
    """
    sid = data.get("sid", "")
    if not sid:
        return

    run_id = data.get("run_id")
    group_id_str = data.get("group_id", "")
    modality = data.get("modality", "text")
    artifact_type = data.get("artifact_type", "unknown")

    # Identity context — propagated through the pipeline
    profile_id_str = data.get("profile_id")
    profiles_id_str = data.get("profiles_id")
    session_id_str = data.get("session_id")

    logger.info(
        f"generate_run_complete - modality={modality}, group_id={group_id_str}, "
        f"input_tokens={data.get('input_text_tokens', 0)}, "
        f"output_tokens={data.get('output_text_tokens', 0)}"
    )

    # Audio continuation: re-enter rate limit gate
    if modality == "audio":
        if group_id_str:
            await internal_sio.emit(
                "generate",
                {
                    "sid": sid,
                    "profile_id": profile_id_str,
                    "profiles_id": profiles_id_str,
                    "session_id": session_id_str,
                    "artifact_types": data.get("artifact_types")
                    or [{"name": artifact_type, "operation": "get"}],
                    "group_id": group_id_str,
                    "metadata": data.get("metadata", {}),
                },
            )
        return

    if not run_id or not session_id_str:
        return

    run_uuid = uuid.UUID(run_id)
    session_id = uuid.UUID(session_id_str)
    assistant_output = data.get("assistant_output") or ""
    input_tokens = data.get("input_text_tokens", 0)
    output_tokens = data.get("output_text_tokens", 0)

    # Step 1: Save assistant message + token counts
    try:
        async with get_db_connection() as conn:
            if assistant_output:
                await persist_run_message(
                    conn, run_id=run_uuid,
                    session_id=session_id,
                    role="assistant", content=assistant_output,
                )

            if input_tokens or output_tokens:
                await create_token(
                    conn, run_id=run_uuid, session_id=session_id,
                    input_tokens=input_tokens, output_tokens=output_tokens,
                )
    except Exception as e:
        logger.exception(f"Failed to save run_complete for {artifact_type}: {e}")

    # Step 2: Multi-agent coordination (new tracker)
    redis = get_redis_client()
    tool_results = data.get("tool_results") or []
    is_complete, all_tool_results = await record_agent_done(
        redis, run_id=run_id, tool_results=tool_results,
    )

    if not is_complete:
        return  # More agents pending

    # Step 3: All agents finished — aggregate results (pure)
    resource_actions, entry_actions = aggregate_tool_results(all_tool_results)

    # Chat special case: inject _attempt_chat_id
    metadata = data.get("metadata") or {}
    if artifact_type == "chat":
        attempt_chat_id_meta = metadata.get("attempt_chat_id")
        if attempt_chat_id_meta:
            resource_actions["_attempt_chat_id"] = attempt_chat_id_meta

    # Step 4: Auto-save
    artifact_id: str | None = None
    should_save = data.get("save", True)

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
                    # TODO: pass entry_actions=entry_actions once save_artifact supports it
                )
                if saved_id:
                    artifact_id = str(saved_id)
        except Exception as e:
            logger.exception(f"Failed to auto-save {artifact_type}: {e}")

    # Step 5: Build + flush events
    events: list[SocketEvent] = []

    if artifact_id:
        events.append(internal_event(
            "generation_channel",
            GenerationSavedData(
                sid=sid, artifact_type=artifact_type,
                group_id=group_id_str, run_id=run_id,
                artifact_id=artifact_id,
            ).model_dump(mode="json"),
        ))

    events.append(internal_event(
        "generation_channel",
        GenerationCompleteData(
            sid=sid, artifact_type=artifact_type,
            group_id=group_id_str, run_id=run_id,
            success=True,
            message=f"{artifact_type.capitalize()} generation completed",
            artifact_id=artifact_id,
            resource_actions=resource_actions,
        ).model_dump(mode="json"),
    ))

    # Step 6: Chat special case (MV refresh + cache invalidation)
    if artifact_type == "chat":
        attempt_id_data = metadata.get("attempt_id")
        attempt_chat_id_data = metadata.get("attempt_chat_id")
        if should_save and attempt_id_data and attempt_chat_id_data:
            try:
                async with get_db_connection() as conn:
                    await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
                    await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")
                await invalidate_tags(["attempt", "attempts"], redis=redis)

                events.append(internal_event(
                    "attempt_chat_started",
                    AttemptChatStartedData(
                        sid=sid,
                        attempt_id=attempt_id_data,
                        chat_id=attempt_chat_id_data,
                    ).model_dump(mode="json"),
                ))
            except Exception as e:
                logger.exception(f"Failed chat post-save: {e}")

    # Step 7: Cleanup trackers
    await cleanup_run(redis, run_id=run_id)

    # Flush
    await flush_events(events, internal_sio=internal_sio)
