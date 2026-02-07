"""Document completion handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_document_complete(data: dict[str, Any]) -> None:
    """Handle completed tool events and emit document-specific complete payloads."""
    if data.get("artifact_type") != "document":
        return
    if data.get("eval_mode", False):
        return

    sid = data.get("sid")
    if not sid:
        return

    if data.get("event_type") not in ("tool_call_complete", "tool_result"):
        return

    resource_type = data.get("resource_type")
    group_id = data.get("group_id")
    if not resource_type or not group_id:
        return

    tool_result = data.get("result") or {}
    tool_results = data.get("tool_results") or []
    if not tool_result and tool_results:
        tool_result = tool_results[0]

    resource_id = tool_result.get("resource_id")
    if not resource_id:
        tool_success = tool_result.get("success", True)
        if not tool_success:
            return
        await sio.emit(
            "document_generation_error",
            {
                "artifact_type": "document",
                "resource_type": resource_type,
                "group_id": group_id,
                "success": False,
                "message": f"Missing resource_id for {resource_type} tool result",
            },
            room=sid,
        )
        return

    payload: dict[str, Any] = {
        "artifact_type": "document",
        "group_id": group_id,
        "resource_type": resource_type,
        "success": True,
        "message": f"{resource_type} generation completed successfully",
        "run_id": data.get("run_id"),
        "type": data.get("type", "complete"),
    }

    # Client expects IDs by resource bucket.
    if resource_type == "names":
        payload["name_id"] = resource_id
    elif resource_type == "descriptions":
        payload["description_id"] = resource_id
    elif resource_type == "flags":
        payload["active_flag_id"] = resource_id
    elif resource_type == "departments":
        payload["department_ids"] = [resource_id]
    elif resource_type == "fields":
        payload["field_ids"] = [resource_id]
    elif resource_type == "uploads":
        payload["upload_ids"] = [resource_id]

    await sio.emit("document_generation_complete", payload, room=sid)


@server_router.post("/document_generation_complete")
async def document_generation_complete_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: document generation complete."""
    _ = request
    return {"ok": True}
