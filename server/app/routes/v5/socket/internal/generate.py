"""Rate limit gate — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generation_events_impl import generate_gate_impl
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate")  # type: ignore
async def generate_handler(data: dict[str, Any]) -> None:
    await generate_gate_impl(data, emit=make_emit())
