"""Output: persona.search.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.search.started")  # type: ignore
async def persona_search_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.search.started", data, room=room)


@internal_sio.on("persona.search.progress")  # type: ignore
async def persona_search_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.search.progress", data, room=room)


@internal_sio.on("persona.search.completed")  # type: ignore
async def persona_search_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.search.completed", data, room=room)


@internal_sio.on("persona.search.failed")  # type: ignore
async def persona_search_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.search.failed", data, room=room)
