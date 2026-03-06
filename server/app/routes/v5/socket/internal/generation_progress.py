"""Resource/entry progress tracking (new) — uses run_tracker.record_unit_soft.

Replaces generation_progress.py.

Differences from generation_progress.py:
  - Uses record_unit_soft from new run_tracker (work-unit state machine)
  - Also tracks entry completions (entry_type + entry_id), not just resources
  - Calls legacy record_resource_complete in parallel during migration

GAPs / TODOs:
  - agent_id is now propagated: GenerateArtifactPayload.agent_id → tool_result
          → generate_call_complete → this handler. Falls back to "unknown" only
          for old callers that don't set agent_id.
  - TODO: Entry progress events (entry_type/entry_id in tool_result) are not
          currently emitted by generate_artifact. Once they are, this handler
          will automatically track them.
"""

from __future__ import annotations

from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.generation_tracker import record_resource_complete
from app.infra.websocket.run_tracker import record_unit_soft
from app.routes.v5.socket.internal.generation_types import GenerationProgressData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_resource_progress_new(data: dict[str, Any]) -> None:
    """Track resource/entry completions and emit progress percentage."""
    event_type = data.get("event_type")
    if event_type != "tool_result":
        return

    sid = data.get("sid", "")
    run_id = data.get("run_id")
    if not sid or not run_id:
        return

    tool_result = data.get("result") or {}
    resource_id = tool_result.get("resource_id")
    entry_id = tool_result.get("entry_id")

    if not resource_id and not entry_id:
        return

    artifact_type = data.get("artifact_type", "unknown")
    group_id_str = data.get("group_id", "")
    resource_type = tool_result.get("resource_type") or data.get("resource_type", "")
    entry_type = tool_result.get("entry_type") or ""

    target_type = "resource" if resource_id else "entry"
    target_name = resource_type if resource_id else entry_type
    result_id = resource_id or entry_id

    redis = get_redis_client()

    # New tracker: record_unit_soft
    agent_id = data.get("agent_id") or "unknown"

    try:
        completed, total = await record_unit_soft(
            redis,
            run_id=run_id,
            agent_id=agent_id,
            target_type=target_type,
            target_name=target_name,
            result_id=result_id,
        )
    except Exception as e:
        logger.exception(f"Failed to record unit progress: {e}")
        completed, total = 1, 1

    # Legacy tracker: also update for backward compat during migration
    if resource_id:
        try:
            await record_resource_complete(run_id, resource_type)
        except Exception:
            pass  # Best-effort legacy compat

    percentage = round((completed / total) * 100) if total > 0 else 0

    await internal_sio.emit(
        "generation_channel",
        GenerationProgressData(
            sid=sid,
            artifact_type=artifact_type,
            group_id=group_id_str,
            run_id=run_id,
            completed_resources=completed,
            total_resources=total,
            percentage=min(percentage, 100),
            last_completed_resource=target_name,
        ).model_dump(mode="json"),
    )
