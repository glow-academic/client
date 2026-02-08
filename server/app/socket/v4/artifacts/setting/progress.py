"""Setting progress handler - emits setting-specific generation progress events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
async def handle_setting_call_progress(data: dict[str, Any]) -> None:
    if data.get("artifact_type") != "setting":
        return

    sid = data.get("sid")
    if not sid:
        return

    await sio.emit(
        "setting_generation_progress",
        {
            "artifact_type": "setting",
            "resource_type": data.get("resource_type"),
            "resource_id": data.get("resource_id"),
            "run_id": data.get("run_id"),
            "group_id": data.get("group_id"),
            "event_type": data.get("event_type"),
            "type": data.get("type", "progress"),
            "trace_id": data.get("trace_id"),
        },
        room=sid,
    )


@server_router.post("/setting_generation_progress")
async def setting_generation_progress_api(request: dict[str, Any]) -> dict[str, bool]:
    _ = request
    return {"ok": True}
