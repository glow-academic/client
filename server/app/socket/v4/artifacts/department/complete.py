"""Department completion handler - emits department-specific generation complete events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.settings.get import get_settings_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.department.types import DepartmentGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_department_artifact_complete(data: dict[str, Any]) -> None:
    if data.get("artifact_type") != "department":
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
    generated_resource_id = tool_result.get("resource_id")

    artifact_id_str = data.get("resource_id")
    profile_id_str = await find_profile_by_socket(sid)
    if not artifact_id_str or not profile_id_str:
        return

    try:
        # Fetch full resource objects using _internal() functions
        name_resource = None
        description_resource = None
        flag_resource = None
        settings_resources = None

        if generated_resource_id:
            resource_id = uuid.UUID(generated_resource_id)
            async with get_db_connection() as conn:
                if resource_type == "names":
                    items = await get_names_internal(conn, [resource_id], True)
                    name_resource = items[0] if items else None
                elif resource_type == "descriptions":
                    items = await get_descriptions_internal(conn, [resource_id], True)
                    description_resource = items[0] if items else None
                elif resource_type == "flags":
                    items = await get_flags_internal(conn, [resource_id], True)
                    flag_resource = items[0] if items else None
                elif resource_type == "settings":
                    item = await get_settings_internal(conn, resource_id, True)
                    settings_resources = [item] if item else None

    except Exception as e:
        await sio.emit(
            "department_generation_error",
            {
                "artifact_type": "department",
                "resource_type": resource_type,
                "group_id": data.get("group_id"),
                "message": str(e),
                "success": False,
            },
            room=sid,
        )
        return

    event = DepartmentGenerationCompleteEvent(
        artifact_type="department",
        group_id=data.get("group_id", ""),
        resource_type=resource_type or "department",
        run_id=data.get("run_id"),
        success=bool(generated_resource_id),
        message=f"{resource_type} generation completed"
        if generated_resource_id
        else "Missing resource_id in tool result",
        type=data.get("type", "complete"),
        name_resource=name_resource,
        description_resource=description_resource,
        flag_resource=flag_resource,
        settings_resources=settings_resources,
    )

    await sio.emit(
        "department_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


@server_router.post("/department_generation_complete")
async def department_generation_complete_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    _ = request
    return {"ok": True}
