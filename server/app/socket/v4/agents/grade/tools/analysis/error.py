"""Handler for analysis tool error event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class AnalysisErrorPayload(BaseModel):
    """Analysis tool error event."""

    success: bool
    chat_id: str
    trace_id: str
    message: str


async def _analysis_error_impl(
    sid: str,
    data: AnalysisErrorPayload,
    profile_id: Any,
    group_id: Any | None = None,
) -> None:
    """Handle analysis_error - errors are handled in call.py."""
    # Errors are handled synchronously in call.py
    pass


@internal_sio.on("grade_analysis_error")  # type: ignore
async def analysis_error_internal(data: dict[str, Any]) -> None:
    """Handle analysis_error event from internal bus."""
    # Errors are handled synchronously in call.py
    pass


register_server_endpoint(
    server_router,
    "/analysis_error",
    AnalysisErrorPayload,
    "Analysis tool error",
)

