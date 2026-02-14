"""Shared resource completion handler - hydrates resources and emits per-resource events.

Listens on generate_call_complete (internal sio), filters for tool_call_complete/tool_result
events with a valid resource_id, fetches the hydrated resource via the appropriate
get_*_internal function, and emits resource_generation_complete to the client.
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.colors.get import get_colors_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.examples.get import get_examples_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.icons.get import get_icons_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import ResourceGenerationCompleteEvent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

# Mapping from resource_type to the internal getter function.
# Each getter takes (conn, [resource_id]) and returns a list of Pydantic models.
RESOURCE_GETTERS: dict[str, Any] = {
    "names": get_names_internal,
    "descriptions": get_descriptions_internal,
    "colors": get_colors_internal,
    "icons": get_icons_internal,
    "instructions": get_instructions_internal,
    "flags": get_flags_internal,
    "departments": get_departments_internal,
    "parameter_fields": get_parameter_fields_internal,
    "examples": get_examples_internal,
    "parameters": get_parameters_internal,
}


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_resource_generation_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete - emit per-resource hydrated events to client."""
    event_type = data.get("event_type")
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    sid = data.get("sid", "")
    if not sid:
        return

    group_id_str = data.get("group_id")
    resource_type = data.get("resource_type")
    if not group_id_str or not resource_type:
        return

    # Extract resource_id from tool result
    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if not tool_result:
        return

    resource_id_str = tool_result.get("resource_id")
    if not resource_id_str:
        # Tool failure - model can retry, don't emit error
        tool_success = tool_result.get("success", True)
        if not tool_success:
            return
        return

    getter = RESOURCE_GETTERS.get(resource_type)
    if not getter:
        # Also check "fields" alias for parameter_fields
        if resource_type == "fields":
            getter = RESOURCE_GETTERS.get("parameter_fields")
        if not getter:
            return

    resource_id = uuid.UUID(resource_id_str)

    try:
        async with get_db_connection() as conn:
            items = await getter(conn, [resource_id])
            resource_data = {}
            if items:
                item = items[0]
                resource_data = (
                    item.model_dump(mode="json") if hasattr(item, "model_dump") else {}
                )
    except Exception as e:
        logger.exception(f"Failed to fetch resource {resource_type}/{resource_id}: {e}")
        await sio.emit(
            "resource_generation_error",
            {
                "artifact_type": data.get("artifact_type", ""),
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    event = ResourceGenerationCompleteEvent(
        artifact_type=data.get("artifact_type", ""),
        resource_type=resource_type,
        resource_id=resource_id_str,
        group_id=group_id_str,
        run_id=data.get("run_id"),
        success=True,
        resource_data=resource_data,
    )

    await sio.emit(
        "resource_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/resource_generation_complete")
async def resource_generation_complete_api(
    request: ResourceGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Resource generation completed.

    Emitted when a single resource is successfully generated.
    Contains the hydrated resource data for immediate frontend use.
    """
    return {"success": True}
