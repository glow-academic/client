"""Persona progress handler - emits percentage-based progress as resources complete.

Listens on generate_call_complete, filters for persona artifact with tool_result events
that have a resource_id (successful resource creation), and emits persona_generation_progress
with percentage tracking.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.generation_tracker import record_resource_complete
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.persona.types import PersonaGenerationProgressEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_persona_resource_progress(data: dict[str, Any]) -> None:
    """Track resource completions and emit persona progress percentage."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "persona":
        return

    event_type = data.get("event_type")
    if event_type != "tool_result":
        return

    sid = data.get("sid", "")
    run_id = data.get("run_id")
    group_id_str = data.get("group_id", "")
    if not sid or not run_id:
        return

    # Only count events with a resource_id (successful resource creation)
    tool_result = data.get("result") or {}
    resource_id = tool_result.get("resource_id")
    if not resource_id:
        return

    resource_type = tool_result.get("resource_type") or data.get("resource_type", "")

    try:
        completed, total = await record_resource_complete(run_id, resource_type)
    except Exception as e:
        logger.exception(f"Failed to record resource progress: {e}")
        return

    percentage = round((completed / total) * 100) if total > 0 else 0

    event = PersonaGenerationProgressEvent(
        group_id=group_id_str,
        run_id=run_id,
        completed_resources=completed,
        total_resources=total,
        percentage=min(percentage, 100),
        last_completed_resource=resource_type,
    )

    await sio.emit(
        "persona_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/persona_generation_progress")
async def persona_generation_progress_api(
    request: PersonaGenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Persona generation progress.

    Emitted as individual resources complete during persona generation.
    Contains percentage-based progress tracking.
    """
    return {"success": True}
