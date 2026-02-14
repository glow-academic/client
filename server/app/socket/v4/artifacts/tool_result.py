"""Tool result handler - resolves tool call RPC futures."""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.tool_registry import resolve_tool_result
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("tool_result")  # type: ignore
async def tool_result_internal(data: dict[str, Any]) -> None:
    """Resolve tool result for token factory."""
    call_id = data.get("call_id") or data.get("tool_call_id")
    if not call_id:
        return
    resolve_tool_result(str(call_id), data)
