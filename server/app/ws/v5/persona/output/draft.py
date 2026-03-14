"""Output: persona.draft.{started,progress,completed,failed}"""

from typing import Any

from app.infra.globals import get_internal_sio, sio

internal_sio = get_internal_sio()


@internal_sio.on("persona.draft.started")  # type: ignore
async def persona_draft_started(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.draft.started", data, room=room)


@internal_sio.on("persona.draft.progress")  # type: ignore
async def persona_draft_progress(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.draft.progress", data, room=room)


@internal_sio.on("persona.draft.completed")  # type: ignore
async def persona_draft_completed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.draft.completed", data, room=room)


@internal_sio.on("persona.draft.failed")  # type: ignore
async def persona_draft_failed(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    rooms = data.get("rooms") or ([sid] if sid else [])
    for room in rooms:
        await sio.emit("persona.draft.failed", data, room=room)
