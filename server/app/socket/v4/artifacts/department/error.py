"""Department error handler - emits department-specific generation error events."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.department.types import DepartmentGenerationErrorEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_department_generation_error(data: dict[str, Any]) -> None:
    artifact_type = data.get("artifact_type")
    if artifact_type != "department":
        return

    sid = data.get("sid")
    if not sid:
        return

    event = DepartmentGenerationErrorEvent(
        artifact_type=artifact_type,
        resource_type=data.get("resource_type"),
        resource_types=data.get("resource_types"),
        group_id=data.get("group_id"),
        message=data.get("error_message") or data.get("message") or "Generation failed",
        success=False,
    )

    await sio.emit(
        "department_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )


@server_router.post("/department_generation_error")
async def department_generation_error_api(request: dict[str, Any]) -> dict[str, bool]:
    _ = request
    return {"ok": True}
