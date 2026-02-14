"""Documents resource completion handler."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.documents.get import get_documents_internal
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.resources.documents.types import DocumentsGenerationCompleteEvent
from app.socket.v4.resources.utils import resolve_resource_type
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_complete(data: dict[str, Any]) -> None:
    """Handle documents generation complete - hydrate and emit typed event."""
    sid = data.get("sid", "")
    group_id_str = data.get("group_id", "")
    run_id = data.get("run_id")
    tool_result = data.get("result") or {}
    resource_id_str = tool_result.get("resource_id")

    if not sid or not resource_id_str:
        return

    resource_id = uuid.UUID(resource_id_str)

    try:
        async with get_db_connection() as conn:
            items = await get_documents_internal(conn, [resource_id])
            if not items:
                return
            item = items[0]
            resource_data = (
                item.model_dump(mode="json") if hasattr(item, "model_dump") else {}
            )
    except Exception as e:
        logger.exception(f"Failed to fetch documents/{resource_id}: {e}")
        return

    event = DocumentsGenerationCompleteEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_id=resource_id_str,
        group_id=group_id_str,
        run_id=run_id,
        **resource_data,
    )

    await sio.emit(
        "documents_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_complete")  # type: ignore
async def documents_call_complete_listener(data: dict[str, Any]) -> None:
    """Listen for tool_result events targeting documents."""
    if data.get("event_type") != "tool_result":
        return
    if resolve_resource_type(data) != "documents":
        return
    await handle_complete(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/documents_generation_complete")
async def documents_generation_complete_api(
    request: DocumentsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Documents generation completed."""
    return {"success": True}
