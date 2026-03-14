"""Output: persona.create.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.create.started")  # type: ignore
async def persona_create_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.create.started", data, room=room)


@internal_sio.on("persona.create.progress")  # type: ignore
async def persona_create_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.create.progress", data, room=room)


@internal_sio.on("persona.create.completed")  # type: ignore
async def persona_create_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.create.completed", data, room=room)


@internal_sio.on("persona.create.failed")  # type: ignore
async def persona_create_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.create.failed", data, room=room)
