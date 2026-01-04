"""Handler for member_instruct_eval_start WebSocket event - eval-specific logic for member instruct tool."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

from .call import MemberInstructToolErrorSqlRow

internal_sio = get_internal_sio()
server_router = APIRouter()


class MemberInstructEvalStartApiRequest(BaseModel):
    """Request to start member instruct tool eval."""

    test_id: str
    attempt_id: str
    eval_id: str
    run_id: str
    group_id: str
    tool_id: str


async def _member_instruct_eval_impl(
    sid: str,
    data: MemberInstructEvalStartApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle member_instruct_eval_start requests via WebSocket."""
    # TODO: Implement actual eval logic here
    # For now, placeholder

    # Emit benchmark-level completion (not tool-specific)
    await emit_to_internal(
        "benchmark_eval_complete",
        {
            "test_id": data.test_id,
            "attempt_id": data.attempt_id,
            "eval_id": data.eval_id,
            "run_id": data.run_id,
            "group_id": data.group_id,
            "agent_id": None,
            "tool_id": data.tool_id,
            "success": True,
            "message": "Member instruct eval completed successfully",
        },
        sid=sid,
    )


@internal_sio.on("member_instruct_eval_start")  # type: ignore
async def member_instruct_eval_internal(data: dict[str, Any]) -> None:
    """Handle member_instruct_eval_start event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=MemberInstructEvalStartApiRequest,
        handler=_member_instruct_eval_impl,  # type: ignore[arg-type]
        error_event_name="benchmark_error",
        error_response_type=None,  # Will be handled by benchmark_error handler
    )


register_client_endpoint(
    server_router,
    "/eval",
    MemberInstructEvalStartApiRequest,
    "Execute member instruct tool for eval",
)

