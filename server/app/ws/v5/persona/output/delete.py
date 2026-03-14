"""Output: persona.delete.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.delete.started")  # type: ignore
async def persona_delete_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.delete.started", data, room=room)


@internal_sio.on("persona.delete.progress")  # type: ignore
async def persona_delete_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.delete.progress", data, room=room)


@internal_sio.on("persona.delete.completed")  # type: ignore
async def persona_delete_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.delete.completed", data, room=room)


@internal_sio.on("persona.delete.failed")  # type: ignore
async def persona_delete_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.delete.failed", data, room=room)
