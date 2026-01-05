"""Handler for prompt_eval_start WebSocket event - eval-specific logic for prompt agent."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        AgentsPromptPromptEvalStartApiRequest,
    )
except ImportError:
    from pydantic import BaseModel

    class AgentsPromptPromptEvalStartApiRequest(BaseModel):
        test_id: str
        attempt_id: str
        eval_id: str
        run_id: str
        group_id: str
        agent_id: str


async def _prompt_eval_impl(
    sid: str,
    data: AgentsPromptPromptEvalStartApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle prompt_eval_start requests via WebSocket."""
    # TODO: Implement actual eval logic here
    # For now, placeholder

    # Emit benchmark-level completion (not agent-specific)
    await internal_sio.emit(
        "benchmark_eval_complete",
        {
            "test_id": data.test_id,
            "attempt_id": data.attempt_id,
            "eval_id": data.eval_id,
            "run_id": data.run_id,
            "group_id": data.group_id,
            "agent_id": data.agent_id,
            "tool_id": None,
            "success": True,
            "message": "Prompt eval completed successfully",
            "sid": sid,
        },
    )


@internal_sio.on("prompt_eval_start")  # type: ignore
async def prompt_eval_internal(data: dict[str, Any]) -> None:
    """Handle prompt_eval_start event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=AgentsPromptPromptEvalStartApiRequest,
        handler=_prompt_eval_impl,  # type: ignore[arg-type]
        error_event_name="benchmark_error",
        error_response_type=None,  # Will be handled by benchmark_error handler
    )


register_client_endpoint(
    server_router,
    "/eval",
    AgentsPromptPromptEvalStartApiRequest,
    "Execute prompt agent for eval",
)
