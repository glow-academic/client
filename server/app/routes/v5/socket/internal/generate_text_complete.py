"""Text complete — thin socket handler."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.text_complete_impl import text_complete_impl

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_text_complete(data: dict[str, Any]) -> None:
    async with get_db_connection() as conn:
        await text_complete_impl(data, emit=make_emit(), conn=conn)
