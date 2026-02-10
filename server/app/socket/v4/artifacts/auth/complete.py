"""Auth completion handler - emits auth generation completion events."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.auth.get import derive_flag_key_and_label
from app.api.v4.artifacts.auth.types import AuthFlagConfig
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.items.get import get_items_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.protocols.get import get_protocols_internal
from app.api.v4.resources.slugs.get import get_slugs_internal
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.auth.types import (
    AUTH_GENERATE_RESOURCE_TYPES,
    AuthGenerationCompleteEvent,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_auth_artifact_complete(data: dict[str, Any]) -> None:
    if data.get("eval_mode", False):
        return

    if data.get("artifact_type") != "auth":
        return

    sid = data.get("sid")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    if data.get("event_type") not in ("tool_call_complete", "tool_result"):
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]

    resource_type = data.get("resource_type")
    group_id = data.get("group_id")
    resource_id_str = tool_result.get("resource_id")

    if not group_id or not resource_type:
        return

    if resource_type not in AUTH_GENERATE_RESOURCE_TYPES:
        return

    if not resource_id_str:
        await sio.emit(
            "auth_generation_error",
            {
                "artifact_type": "auth",
                "resource_type": resource_type,
                "group_id": group_id,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    event = AuthGenerationCompleteEvent(
        artifact_type="auth",
        group_id=group_id,
        resource_type=resource_type,
        run_id=data.get("run_id"),
        success=True,
        message=f"{resource_type} generation completed",
    )

    try:
        resource_id = uuid.UUID(resource_id_str)
        async with get_db_connection() as conn:
            if resource_type == "names":
                items = await get_names_internal(conn, [resource_id], True)
                event.name_resource = items[0] if items else None
            elif resource_type == "descriptions":
                items = await get_descriptions_internal(conn, [resource_id], True)
                event.description_resource = items[0] if items else None
            elif resource_type == "flags":
                items = await get_flags_internal(conn, [resource_id], True)
                flag = items[0] if items else None
                if flag is not None:
                    key, label = derive_flag_key_and_label(flag.name)
                    event.flag_resource = AuthFlagConfig(
                        key=key,
                        label=label,
                        description=flag.description,
                        icon_id=flag.icon,
                        flag_option_id=flag.id,
                        show=True,
                        required=False,
                        generated=flag.generated,
                    )
            elif resource_type == "protocols":
                items = await get_protocols_internal(conn, [resource_id], True)
                event.protocol_resources = items if items else None
            elif resource_type == "slugs":
                items = await get_slugs_internal(conn, [resource_id], True)
                event.slug_resources = items if items else None
            elif resource_type == "items":
                items = await get_items_internal(conn, [resource_id], True)
                event.item_resources = items if items else None
    except Exception as e:
        await sio.emit(
            "auth_generation_error",
            {
                "artifact_type": "auth",
                "resource_type": resource_type,
                "group_id": group_id,
                "success": False,
                "message": str(e),
            },
            room=sid,
        )
        return

    await sio.emit("auth_generation_complete", event.model_dump(mode="json"), room=sid)


@server_router.post("/auth_generation_complete")
async def auth_generation_complete_api(
    request: AuthGenerationCompleteEvent,
) -> dict[str, bool]:
    _ = request
    return {"success": True}
