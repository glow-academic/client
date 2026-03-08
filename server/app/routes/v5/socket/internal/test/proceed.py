"""Internal handler: test_proceed — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_proceed_impl

internal_sio = get_internal_sio()


@internal_sio.on("test_proceed")  # type: ignore
async def test_proceed_handler(data: dict[str, Any]) -> None:
    async with get_db_connection() as conn:
        await test_proceed_impl(
            data, emit=make_emit(), conn=conn, redis=get_redis_client()
        )
