"""Tool completion handler - emits tool-specific generation complete events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import GetToolApiRequest, GetToolSqlParams, GetToolSqlRow
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/tools/get_tool_complete.sql"


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_tool_artifact_complete(data: dict[str, Any]) -> None:
    if data.get("eval_mode", False):
        return

    if data.get("artifact_type") != "tool":
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
        async with get_db_connection() as conn:
            request_payload = GetToolApiRequest.model_validate(
                {"tool_id": uuid.UUID(artifact_id_str)}
            )
            params = GetToolSqlParams(
                profile_id=uuid.UUID(profile_id_str),
                **request_payload.model_dump(),
            )
            result = cast(
                GetToolSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )
    except Exception as e:
        await sio.emit(
            "tool_generation_error",
            {
                "artifact_type": "tool",
                "resource_type": resource_type,
                "group_id": data.get("group_id"),
                "message": str(e),
                "success": False,
            },
            room=sid,
        )
        return

    payload: dict[str, Any] = {
        "artifact_type": "tool",
        "group_id": str(getattr(result, "group_id", None))
        if getattr(result, "group_id", None)
        else data.get("group_id"),
        "resource_type": resource_type,
        "run_id": data.get("run_id"),
        "success": bool(generated_resource_id),
        "message": f"{resource_type} generation completed"
        if generated_resource_id
        else "Missing resource_id in tool result",
        "type": data.get("type", "complete"),
    }

    values = getattr(result, "args_ids", None) or []
    payload["args_ids"] = [str(v) for v in values if v]
    values = getattr(result, "args_outputs_ids", None) or []
    payload["args_outputs_ids"] = [str(v) for v in values if v]

    await sio.emit(
        "tool_generation_complete",
        payload,
        room=sid,
    )


@server_router.post("/tool_generation_complete")
async def tool_generation_complete_api(request: dict[str, Any]) -> dict[str, bool]:
    _ = request
    return {"ok": True}
