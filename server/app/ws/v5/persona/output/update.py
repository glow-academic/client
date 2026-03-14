"""Output: persona.update.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.update.started")  # type: ignore
async def persona_update_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.update.started", data, room=room)


@internal_sio.on("persona.update.progress")  # type: ignore
async def persona_update_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.update.progress", data, room=room)


@internal_sio.on("persona.update.completed")  # type: ignore
async def persona_update_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.update.completed", data, room=room)


@internal_sio.on("persona.update.failed")  # type: ignore
async def persona_update_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.update.failed", data, room=room)
