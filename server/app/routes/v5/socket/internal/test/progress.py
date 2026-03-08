"""Internal handler: test_progress_update + test_run_done — thin wrappers."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_progress_impl, test_run_done_impl

internal_sio = get_internal_sio()


@internal_sio.on("test_progress_update")  # type: ignore
async def handle_test_progress(data: dict[str, Any]) -> None:
    await test_progress_impl(data, emit=make_emit())


@internal_sio.on("test_run_done")  # type: ignore
async def handle_test_run_complete(data: dict[str, Any]) -> None:
    await test_run_done_impl(data, emit=make_emit())
