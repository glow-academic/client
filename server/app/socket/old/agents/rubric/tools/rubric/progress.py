"""Handler for rubric_standard_description_progress - handles incremental updates for standard_description tool calls."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class RubricStandardDescriptionProgressPayload(BaseModel):
    """Rubric standard description tool progress event."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    rubric_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    arguments_raw: str


class RubricStandardDescriptionProgressErrorPayload(BaseModel):
    """Error response for rubric standard description progress."""

    success: bool
    message: str


# Client-facing payload models
class RubricProgressPayload(BaseModel):
    """Progress update for rubric generation."""

    type: str
    rubric_id: str | None = None
    tool_name: str | None = None
    arguments_raw: str | None = None


async def _rubric_standard_description_progress_impl(
    sid: str,
    data: RubricStandardDescriptionProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle rubric_standard_description_progress - tracks progress and emits to client."""
    try:
        if data.type == "tool_call_start":
            # Tool call started - no-op for now, will be handled on first progress
            pass

        elif data.type == "tool_call_progress":
            # Emit progress to client
            await sio.emit(
                "rubrics_generation_progress",
                RubricProgressPayload(
                    type="tool_call_progress",
                    rubric_id=data.rubric_id,
                    tool_name=data.tool_name,
                    arguments_raw=data.arguments_raw,
                ).model_dump(),
                room=sid,
            )

    except Exception as e:
        await internal_sio.emit(
            "rubric_standard_description_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("rubric_standard_description_progress")  # type: ignore
async def rubric_standard_description_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle rubric_standard_description_progress event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=RubricStandardDescriptionProgressPayload,
        handler=_rubric_standard_description_progress_impl,  # type: ignore[arg-type]
        error_event_name="rubric_standard_description_error",
        error_response_type=RubricStandardDescriptionProgressErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/rubric_standard_description_progress",
    RubricStandardDescriptionProgressPayload,
    "Progress update for Rubric standard description tool",
)
