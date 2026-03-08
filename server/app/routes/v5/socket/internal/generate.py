"""Rate limit gate — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.generate_new_impl import generate_new_impl
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("generate")  # type: ignore
async def generate_handler(data: dict[str, Any]) -> None:
    async with get_db_connection() as conn:
        await generate_new_impl(data, emit=make_emit(), conn=conn)
