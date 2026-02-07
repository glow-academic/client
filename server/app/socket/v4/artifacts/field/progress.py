"""Field progress handler - emits field-specific generation progress events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
async def handle_field_call_progress(data: dict[str, Any]) -> None:
    artifact_type = data.get("artifact_type")
    if artifact_type != "field":
        return

    sid = data.get("sid")
    if not sid:
        return

    await sio.emit(
        "field_generation_progress",
        {
            "artifact_type": artifact_type,
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


@server_router.post("/field_generation_progress")
async def field_generation_progress_api(request: dict[str, Any]) -> dict[str, bool]:
    _ = request
    return {"ok": True}
