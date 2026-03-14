"""Output: persona.duplicate.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.duplicate.started")  # type: ignore
async def persona_duplicate_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.duplicate.started", data, room=room)


@internal_sio.on("persona.duplicate.progress")  # type: ignore
async def persona_duplicate_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.duplicate.progress", data, room=room)


@internal_sio.on("persona.duplicate.completed")  # type: ignore
async def persona_duplicate_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.duplicate.completed", data, room=room)


@internal_sio.on("persona.duplicate.failed")  # type: ignore
async def persona_duplicate_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.duplicate.failed", data, room=room)
