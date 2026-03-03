"""Handle resource progress events — track completion percentage.

Replaces ALL v4 progress.py files. Listens on generate_call_complete with
event_type == "tool_result", counts successful resource creations, and emits
generation_channel(type=progress).
"""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generation_tracker import record_resource_complete
from app.routes.v5.socket.internal.generation_types import GenerationProgressData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_resource_progress(data: dict[str, Any]) -> None:
    """Track resource completions and emit progress percentage."""
    event_type = data.get("event_type")
    if event_type != "tool_result":
        return

    sid = data.get("sid", "")
    run_id = data.get("run_id")
    if not sid or not run_id:
        return

    # Only count events with a resource_id (successful resource creation)
    tool_result = data.get("result") or {}
    resource_id = tool_result.get("resource_id")
    if not resource_id:
        return

    artifact_type = data.get("artifact_type", "unknown")
    group_id_str = data.get("group_id", "")
    resource_type = tool_result.get("resource_type") or data.get("resource_type", "")

    try:
        completed, total = await record_resource_complete(run_id, resource_type)
    except Exception as e:
        logger.exception(f"Failed to record resource progress: {e}")
        return

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
            last_completed_resource=resource_type,
        ).model_dump(mode="json"),
    )
