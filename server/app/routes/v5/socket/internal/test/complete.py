"""Internal handler: generate_call_complete (test grade) — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.socket_event import make_emit
from app.infra.websocket.test_events_impl import test_grade_complete_impl

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_complete")  # type: ignore
async def handle_test_grade_complete(data: dict[str, Any]) -> None:
    if data.get("artifact_type") != "test":
        return
    if data.get("resource_type") != "grade":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    await test_grade_complete_impl(
        data, emit=make_emit(), pool=get_pool(), profile_id=profile_id_str
    )
