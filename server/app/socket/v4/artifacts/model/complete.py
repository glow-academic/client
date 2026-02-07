"""Model completion handler - emits model-specific generation complete events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.endpoints.get import get_endpoints_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.keys.get import get_keys_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.pricing.get import get_pricing_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.api.v4.resources.values.get import get_values_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.model.types import ModelGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_model_artifact_complete(data: dict[str, Any]) -> None:
    if data.get("eval_mode", False):
        return

    if data.get("artifact_type") != "model":
        return

    sid = data.get("sid")
    if not sid:
        return

    if data.get("event_type") not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]

    resource_type = data.get("resource_type")
    resource_id_str = tool_result.get("resource_id")

    group_id_str = data.get("group_id")
    profile_id_str = await find_profile_by_socket(sid)
    if not group_id_str or not profile_id_str or not resource_type:
        return

    if not resource_id_str:
        # Check if this was a tool failure
        tool_success = tool_result.get("success", True)
        if not tool_success:
            return
        await sio.emit(
            "model_generation_error",
            {
                "artifact_type": "model",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)

    # Build the typed event with the appropriate resource field populated
    event = ModelGenerationCompleteEvent(
        artifact_type="model",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed successfully",
    )

    try:
        async with get_db_connection() as conn:
            # Fetch the resource using the appropriate internal function
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id])
                event.name_resource = items[0] if items else None
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id])
                event.description_resource = items[0] if items else None
            elif resource_type == "values":
                items = await get_values_internal(conn, [resource_id])
                event.value_resource = items[0] if items else None
            elif resource_type == "endpoints":
                items = await get_endpoints_internal(conn, [resource_id])
                event.endpoint_resource = items[0] if items else None
            elif resource_type == "keys":
                items = await get_keys_internal(conn, [resource_id])
                event.key_resource = items[0] if items else None
            elif resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id])
                event.flag_resource = items[0] if items else None
            elif resource_type == "departments":
                items = await get_departments_internal(conn, [resource_id])
                event.department_resources = items if items else None
            elif resource_type == "temperature_levels":
                items = await get_temperature_levels_internal(conn, [resource_id])
                event.temperature_level_resources = items if items else None
            elif resource_type == "pricing":
                items = await get_pricing_internal(conn, [resource_id])
                event.pricing_resources = items if items else None
            elif resource_type == "reasoning_levels":
                items = await get_reasoning_levels_internal(conn, [resource_id])
                event.reasoning_level_resources = items if items else None
            elif resource_type == "voices":
                items = await get_voices_internal(conn, [resource_id])
                event.voice_resources = items if items else None
    except Exception as e:
        await sio.emit(
            "model_generation_error",
            {
                "artifact_type": "model",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    # Emit the typed event
    await sio.emit(
        "model_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


@server_router.post("/model_generation_complete")
async def model_generation_complete_api(
    request: ModelGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Model generation completed.

    Emitted when a model resource is successfully generated.
    Contains full resource objects for immediate frontend use.
    """
    return {"success": True}
