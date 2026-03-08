"""Internal handler: attempt_next — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.attempt_events_impl import attempt_next_impl
from app.infra.websocket.socket_event import make_emit
from app.routes.v5.socket.client.types import AttemptNextPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_next")  # type: ignore
async def attempt_next_handler(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    if not sid:
        return
    try:
        payload = AttemptNextPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_next payload: {e}")
        return

    await attempt_next_impl(
        data,
        emit=make_emit(),
        attempt_id=str(payload.attempt_id),
        group_id=str(payload.group_id),
        draft_id=str(payload.draft_id) if payload.draft_id else None,
    )
