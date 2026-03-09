"""Internal handler: test_next — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_next_impl
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("test_next")  # type: ignore
async def test_next_handler(data: dict[str, Any]) -> None:
    pool = get_pool()
    if not pool:
        logger.error("Database pool not initialized")
        return

    await test_next_impl(data, emit=make_emit(), pool=pool)
