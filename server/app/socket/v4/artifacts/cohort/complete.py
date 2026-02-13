"""Cohort completion handler - emits typed cohort completion events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.simulation_positions.get import (
    get_simulation_positions_internal,
)
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.cohort.types import CohortGenerationCompleteEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_cohort_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generate_call_complete events and emit typed cohort completion."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "cohort":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    group_id_str = data.get("group_id")
    event_type = data.get("event_type")
    resource_type = data.get("resource_type")

    if event_type not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return

    resource_id_str = tool_result.get("resource_id")

    if not group_id_str or not resource_type:
        return

    if not resource_id_str:
        tool_success = tool_result.get("success", True)
        if not tool_success:
            return
        await sio.emit(
            "cohort_generation_error",
            {
                "artifact_type": "cohort",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)

    event = CohortGenerationCompleteEvent(
        artifact_type="cohort",
        group_id=group_id_str,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed successfully",
        type=data.get("type", "complete"),
    )

    try:
        async with get_db_connection() as conn:
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id])
                if items:
                    item = items[0]
                    event.name_resource = {
                        "id": item.id,
                        "name": item.name,
                        "generated": item.generated,
                    }
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id])
                if items:
                    item = items[0]
                    event.description_resource = {
                        "id": item.id,
                        "description": item.description,
                        "generated": item.generated,
                    }
            elif resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id])
                if items:
                    item = items[0]
                    event.flag_resource = {
                        "id": item.id,
                        "name": item.name,
                        "description": item.description,
                        "icon": item.icon,
                        "generated": item.generated,
                    }
            elif resource_type == "departments":
                items = await get_departments_internal(conn, [resource_id])
                if items:
                    event.department_resources = [
                        {
                            "department_id": d.department_id,
                            "name": d.name,
                            "description": d.description,
                            "generated": d.generated,
                        }
                        for d in items
                    ]
            elif resource_type == "simulations":
                items = await get_simulations_internal(conn, [resource_id])
                if items:
                    item = items[0]
                    event.simulation_resources = [
                        {
                            "simulation_id": item.simulation_id,
                            "name": item.name,
                            "description": item.description,
                            "generated": item.generated,
                        }
                    ]
            elif resource_type == "simulation_positions":
                items = await get_simulation_positions_internal(conn, [resource_id])
                if items:
                    event.simulation_positions = [
                        {
                            "simulation_id": pos.simulation_id,
                            "value": pos.value,
                            "generated": pos.generated,
                            "mcp": pos.mcp,
                        }
                        for pos in items
                    ]
    except Exception as e:
        await sio.emit(
            "cohort_generation_error",
            {
                "artifact_type": "cohort",
                "resource_type": resource_type,
                "group_id": group_id_str,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    await sio.emit(
        "cohort_generation_complete",
        event.model_dump(mode="json"),
        room=sid,
    )


@server_router.post("/cohort_generation_complete")
async def cohort_generation_complete_api(
    request: CohortGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: cohort generation complete."""
    _ = request
    return {"ok": True}
