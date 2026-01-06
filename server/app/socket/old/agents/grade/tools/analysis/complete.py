"""Handler for analysis tool complete event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class AnalysisCompletePayload(BaseModel):
    """Analysis tool complete event."""

    sid: str
    chat_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class AnalysisCompleteErrorPayload(BaseModel):
    """Error response for analysis complete."""

    success: bool
    message: str


async def _analysis_complete_impl(
    sid: str,
    data: AnalysisCompletePayload,
    profile_id: Any,
    group_id: Any | None = None,
) -> None:
    """Handle analysis_complete - analysis is already created in call.py."""
    # Analysis is created synchronously in call.py, so this is just a no-op
    # for consistency with other tool handlers
    pass


@internal_sio.on("grade_analysis_complete")  # type: ignore
async def analysis_complete_internal(data: dict[str, Any]) -> None:
    """Handle analysis_complete event from internal bus."""
    # Analysis is created synchronously in call.py
    pass


register_server_endpoint(
    server_router,
    "/analysis_complete",
    AnalysisCompletePayload,
    "Analysis tool completed successfully",
)

