"""Run completion handler (new) — uses run_tracker triage + promotion.

Replaces generate_run_complete.py.

Flow:
  1. Save assistant message + token counts (unchanged)
  2. record_agent_done — wait for all agents
  3. Triage: get all units, separate contested vs uncontested
  4. Uncontested targets (1 soft unit) → promote_unit() immediately
  5. Contested targets (>1 soft units) → emit test_start for grading
  6. If no contested → emit generation_complete directly
  7. If contested → return, wait for generation_resolve / generation_ended callbacks

The old save:bool / save_artifact flow is removed. All results are already
persisted as dormant records (soft=true) via create_tool_call during generation.
Promotion activates them (soft=false → active=true).

TODOs:
  - TODO: Chat special case (MV refresh + invalidate + attempt_chat_started) stays
          as-is. Should be extracted to a post-save hook.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from app.infra.activate.activate import activate_rows
from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.persist_run_message import persist_run_message
from app.infra.websocket.run_tracker import (
    cleanup_run,
    find_contested_targets,
    find_uncontested_targets,
    get_all_units,
    promote_unit,
    record_agent_done,
)
from app.infra.websocket.socket_event import SocketEvent, flush_events, internal_event
from app.routes.v5.socket.internal.attempt.types import AttemptChatStartedData
from app.routes.v5.socket.internal.generation_types import (
    GenerationCompleteData,
)
from app.routes.v5.socket.internal.prepare_pipeline import aggregate_tool_results
from app.routes.v5.tools.entries.tokens.create import create_token
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


def _table_name(target_type: str, target_name: str) -> str:
    """Derive DB table from run_tracker target: names → names_resource, contents → contents_entry."""
    suffix = "resource" if target_type == "resource" else "entry"
    return f"{target_name}_{suffix}"


# NOTE: Not registered as @internal_sio.on("generate_run_complete") yet.
# To activate: import and swap registration.
async def handle_run_complete_new(data: dict[str, Any]) -> None:
    """Handle run_complete — triage contested vs uncontested, promote or grade.

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

    # Step 3: All agents finished — triage contested vs uncontested
    resource_actions, entry_actions = aggregate_tool_results(all_tool_results)
    units = await get_all_units(redis, run_id=run_id)
    uncontested = find_uncontested_targets(units)
    contested = find_contested_targets(units)

    # Step 4: Auto-promote uncontested targets (single agent per target)
    for (target_type, target_name), (agent_id, unit_state) in uncontested.items():
        try:
            await promote_unit(
                redis,
                run_id=run_id,
                agent_id=agent_id,
                target_type=target_type,
                target_name=target_name,
            )
            # Activate the dormant DB record
            if unit_state.result_id:
                table = _table_name(target_type, target_name)
                async with get_db_connection() as conn:
                    await activate_rows(
                        conn, table=table, ids=[uuid.UUID(unit_state.result_id)]
                    )
        except Exception as e:
            logger.exception(
                f"Failed to promote uncontested unit "
                f"{agent_id}:{target_type}:{target_name}: {e}"
            )

    # Step 5: Handle contested targets — emit test_start for grading
    if contested:
        logger.info(
            f"Run {run_id} has {len(contested)} contested targets, "
            f"emitting test_start for grading"
        )
        # Store run context in Redis meta so generation_resolve / generation_ended
        # can link back to this run's identity context.
        metadata = data.get("metadata") or {}

        # Store generation resolution context in Redis so generation_ended
        # can look it up after test grading completes.
        resolution_ctx = {
            "sid": sid,
            "run_id": run_id,
            "artifact_type": artifact_type,
            "group_id": group_id_str,
            "profile_id": profile_id_str,
            "profiles_id": profiles_id_str,
            "session_id": session_id_str,
            "resource_actions": resource_actions,
            "entry_actions": entry_actions,
            "metadata": metadata,
            "contested_targets": [
                {
                    "target_type": tt,
                    "target_name": tn,
                    "agents": [
                        {"agent_id": aid, "result_id": us.result_id}
                        for aid, us in agents
                    ],
                }
                for (tt, tn), agents in contested.items()
            ],
        }
        try:
            await redis.setex(
                f"generation_resolution:{run_id}",
                3600,
                json.dumps(resolution_ctx),
            )
        except Exception as e:
            logger.warning(f"Failed to store resolution context: {e}")

        # TODO: benchmark_id should come from agent/artifact configuration.
        # For now, metadata.get("resolution_benchmark_id") is the integration point.
        benchmark_id = metadata.get("resolution_benchmark_id")
        if benchmark_id:
            await internal_sio.emit(
                "test_start",
                {
                    "sid": sid,
                    "profile_id": profile_id_str,
                    "benchmark_id": benchmark_id,
                    "infinite_mode": False,
                    # Pass generation_run_id so test_start stores the
                    # test_id → generation_run_id link in Redis.
                    "generation_run_id": run_id,
                },
            )
            # Don't cleanup run — generation_ended will do it after resolution.
            # Don't emit generation_complete — generation_ended will do it.
            return
        else:
            # No benchmark configured — fall back to auto-promoting first agent
            logger.warning(
                f"Run {run_id} has contested targets but no resolution_benchmark_id. "
                f"Auto-promoting first agent per target."
            )
            for (target_type, target_name), agents in contested.items():
                agent_id, unit_state = agents[0]
                try:
                    await promote_unit(
                        redis,
                        run_id=run_id,
                        agent_id=agent_id,
                        target_type=target_type,
                        target_name=target_name,
                    )
                    if unit_state.result_id:
                        table = _table_name(target_type, target_name)
                        async with get_db_connection() as conn:
                            await activate_rows(
                                conn,
                                table=table,
                                ids=[uuid.UUID(unit_state.result_id)],
                            )
                except Exception:
                    pass

    # Step 6: No contested (or fallback) — emit generation_complete
    events: list[SocketEvent] = []

    # Chat special case: inject _attempt_chat_id
    metadata = data.get("metadata") or {}
    if artifact_type == "chat":
        attempt_chat_id_meta = metadata.get("attempt_chat_id")
        if attempt_chat_id_meta:
            resource_actions["_attempt_chat_id"] = attempt_chat_id_meta

    events.append(internal_event(
        "generation_channel",
        GenerationCompleteData(
            sid=sid, artifact_type=artifact_type,
            group_id=group_id_str, run_id=run_id,
            success=True,
            message=f"{artifact_type.capitalize()} generation completed",
            resource_actions=resource_actions,
        ).model_dump(mode="json"),
    ))

    # Chat special case: MV refresh + cache invalidation
    if artifact_type == "chat":
        attempt_id_data = metadata.get("attempt_id")
        attempt_chat_id_data = metadata.get("attempt_chat_id")
        if attempt_id_data and attempt_chat_id_data:
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

    # Step 7: Cleanup trackers + flush
    await cleanup_run(redis, run_id=run_id)
    await flush_events(events, internal_sio=internal_sio)
