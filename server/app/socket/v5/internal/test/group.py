"""Internal handler: test_group — canonical orchestration entry."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_group_impl

internal_sio = get_internal_sio()


async def test_group_internal_impl(data: dict[str, Any], *, emit=None) -> None:
    """Run canonical test group orchestration for any surface."""
    await test_group_impl(data, emit=emit or make_emit(), pool=get_pool())


@internal_sio.on("test_group")  # type: ignore
async def test_group_handler(data: dict[str, Any]) -> None:
    await test_group_internal_impl(data)
