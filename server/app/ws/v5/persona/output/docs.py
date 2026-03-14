"""Output: persona.docs.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.docs.started")  # type: ignore
async def persona_docs_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.docs.started", data, room=room)


@internal_sio.on("persona.docs.progress")  # type: ignore
async def persona_docs_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.docs.progress", data, room=room)


@internal_sio.on("persona.docs.completed")  # type: ignore
async def persona_docs_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.docs.completed", data, room=room)


@internal_sio.on("persona.docs.failed")  # type: ignore
async def persona_docs_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.docs.failed", data, room=room)
