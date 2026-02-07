"""Parameter error handler - emits parameter-specific generation error events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_parameter_generation_error(data: dict[str, Any]) -> None:
    artifact_type = data.get("artifact_type")
    if artifact_type != "parameter":
        return

    sid = data.get("sid")
    if not sid:
        return

    await sio.emit(
        "parameter_generation_error",
        {
            "artifact_type": artifact_type,
            "resource_type": data.get("resource_type"),
            "resource_types": data.get("resource_types"),
            "group_id": data.get("group_id"),
            "message": data.get("error_message") or data.get("message") or "Generation failed",
            "success": False,
        },
        room=sid,
    )


@server_router.post("/parameter_generation_error")
async def parameter_generation_error_api(request: dict[str, Any]) -> dict[str, bool]:
    _ = request
    return {"ok": True}
