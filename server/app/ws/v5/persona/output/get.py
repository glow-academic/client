"""Output: persona.get.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.get.started")  # type: ignore
async def persona_get_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.get.started", data, room=room)


@internal_sio.on("persona.get.progress")  # type: ignore
async def persona_get_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.get.progress", data, room=room)


@internal_sio.on("persona.get.completed")  # type: ignore
async def persona_get_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.get.completed", data, room=room)


@internal_sio.on("persona.get.failed")  # type: ignore
async def persona_get_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.get.failed", data, room=room)
