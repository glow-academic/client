"""Handler for eval_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class EvalCompletePayload(BaseModel):
    """Response indicating Eval generation completed successfully."""

    success: bool
    message: str | None = None


class EvalErrorPayload(BaseModel):
    """Response indicating an error occurred in Eval generation."""

    success: bool
    message: str


async def _eval_complete_impl(
    sid: str,
    data: EvalCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "evals_complete",
        data,
        room=sid,
    )


@internal_sio.on("eval_complete")  # type: ignore
async def eval_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle eval_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=EvalCompletePayload,
        handler=_eval_complete_impl,  # type: ignore[arg-type]
        error_event_name="evals_error",
        error_response_type=EvalErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/eval_complete",
    EvalCompletePayload,
    "Eval generation completed successfully",
)
