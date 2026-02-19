"""Dashboard progress handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
async def handle_dashboard_progress(data: dict[str, Any]) -> None:
    """Forward dashboard generation progress to clients."""
    if data.get("artifact_type") != "dashboard":
        return

    sid = data.get("sid")
    if not sid:
        return

    await sio.emit(
        "dashboard_generation_progress",
        {
            "artifact_type": "dashboard",
            "resource_type": data.get("resource_type"),
            "resource_id": data.get("resource_id"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "type": data.get("type", "progress"),
            "event_type": data.get("event_type"),
            "tool_call_id": data.get("tool_call_id"),
            "tool_name": data.get("tool_name"),
            "arguments": data.get("arguments"),
            "arguments_delta": data.get("arguments_delta"),
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )


@server_router.post("/dashboard_generation_progress")
async def dashboard_generation_progress_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: dashboard generation progress."""
    _ = request
    return {"ok": True}
