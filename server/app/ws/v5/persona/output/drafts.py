"""Output: persona.drafts.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.drafts.started")  # type: ignore
async def persona_drafts_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.drafts.started", data, room=room)


@internal_sio.on("persona.drafts.progress")  # type: ignore
async def persona_drafts_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.drafts.progress", data, room=room)


@internal_sio.on("persona.drafts.completed")  # type: ignore
async def persona_drafts_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.drafts.completed", data, room=room)


@internal_sio.on("persona.drafts.failed")  # type: ignore
async def persona_drafts_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.drafts.failed", data, room=room)
