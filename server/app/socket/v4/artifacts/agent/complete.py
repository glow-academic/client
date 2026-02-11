"""Agent completion handler - emits hydrated completion payloads."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_agent_artifact_complete(data: dict[str, Any]) -> None:
    """Handle generation completion and emit hydrated agent resource payload."""
    if data.get("artifact_type") != "agent":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return
    event_type = data.get("event_type")
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]
    if event_type == "tool_call_complete" and not tool_result and not tool_results:
        return

    if tool_result and tool_result.get("success") is False:
        return

    resource_type = data.get("resource_type")
    resource_id_str = tool_result.get("resource_id")
    group_id = data.get("group_id")
    if not resource_type or not resource_id_str:
        await sio.emit(
            "agent_generation_error",
            {
                "artifact_type": "agent",
                "resource_type": resource_type,
                "group_id": group_id,
                "success": False,
                "message": f"Missing resource_type/resource_id for {resource_type}",
            },
            room=sid,
        )
        return

    resource_id = uuid.UUID(resource_id_str)
    payload: dict[str, Any] = {
        "artifact_type": "agent",
        "group_id": group_id,
        "resource_type": resource_type,
        "success": True,
        "message": f"{resource_type} generation completed successfully",
        "run_id": data.get("run_id"),
        "type": data.get("type", "complete"),
    }

    async with get_db_connection() as conn:
        if resource_type == "names":
            items = await get_names_internal(conn, [resource_id], bypass_cache=True)
            payload["name_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "descriptions":
            items = await get_descriptions_internal(
                conn, [resource_id], bypass_cache=True
            )
            payload["description_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "models":
            items = await get_models_internal(conn, [resource_id], bypass_cache=True)
            payload["model_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "prompts":
            items = await get_prompts_internal(conn, [resource_id], bypass_cache=True)
            payload["prompt_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "instructions":
            items = await get_instructions_internal(
                conn, [resource_id], bypass_cache=True
            )
            payload["instructions_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "flags":
            items = await get_flags_internal(conn, [resource_id], bypass_cache=True)
            payload["flag_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "temperature_levels":
            items = await get_temperature_levels_internal(
                conn, [resource_id], bypass_cache=True
            )
            payload["temperature_level_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "reasoning_levels":
            items = await get_reasoning_levels_internal(
                conn, [resource_id], bypass_cache=True
            )
            payload["reasoning_level_resource"] = (
                items[0].model_dump(mode="json") if items else None
            )
        elif resource_type == "departments":
            items = await get_departments_internal(
                conn, [resource_id], bypass_cache=True
            )
            payload["department_resources"] = [
                item.model_dump(mode="json") for item in items
            ]
        elif resource_type == "tools":
            items = await get_tools_internal(conn, [resource_id], bypass_cache=True)
            payload["tool_resources"] = [item.model_dump(mode="json") for item in items]
        elif resource_type == "voices":
            items = await get_voices_internal(conn, [resource_id], bypass_cache=True)
            payload["voice_resources"] = [
                item.model_dump(mode="json") for item in items
            ]

    await sio.emit("agent_generation_complete", payload, room=sid)


@server_router.post("/agent_generation_complete")
async def agent_generation_complete_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: agent generation complete."""
    _ = request
    return {"ok": True}
