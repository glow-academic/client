"""Rate limit gate (new) — thin socket handler."""

from __future__ import annotations

from typing import Any

from app.infra.websocket.generate_new_impl import generate_new_impl
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit


# NOTE: Not registered as @internal_sio.on("generate") yet.
# To activate: import and swap registration.
async def generate_handler_new(data: dict[str, Any]) -> None:
    async with get_db_connection() as conn:
        await generate_new_impl(data, emit=make_emit(), conn=conn)
