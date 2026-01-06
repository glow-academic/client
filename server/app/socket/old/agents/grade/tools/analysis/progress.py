"""Handler for analysis tool progress event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class AnalysisProgressPayload(BaseModel):
    """Analysis tool progress event."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    arguments_raw: str


class AnalysisProgressErrorPayload(BaseModel):
    """Error response for analysis progress."""

    success: bool
    message: str


async def _analysis_progress_impl(
    sid: str,
    data: AnalysisProgressPayload,
    profile_id: Any,
    group_id: Any | None = None,
) -> None:
    """Handle analysis_progress - no-op for analysis tool."""
    # Analysis tool is synchronous, no progress updates needed
    pass


@internal_sio.on("grade_analysis_progress")  # type: ignore
async def analysis_progress_internal(data: dict[str, Any]) -> None:
    """Handle analysis_progress event from internal bus."""
    # Analysis tool is synchronous, no progress updates needed
    pass


register_server_endpoint(
    server_router,
    "/analysis_progress",
    AnalysisProgressPayload,
    "Analysis tool progress",
)

