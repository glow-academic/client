"""Handler for member_generate WebSocket event - BUILT BUT UNUSED IN THIS MIGRATION."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class MemberGeneratePayload(BaseModel):
    """Request to generate member agent response."""

    chat_id: str
    message: str
    voice_mode: bool = False


class MemberGenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in member generation."""

    success: bool
    message: str


# Emit helper functions
async def member_generate_error(payload: MemberGenerateErrorPayload, room: str) -> None:
    await sio.emit("member_generate_error", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def member_generate(sid: str, data: dict[str, Any]) -> None:
    """Handler for member_generate event - BUILT BUT UNUSED IN THIS MIGRATION."""
    try:
        validated = MemberGeneratePayload(**data)
        # This is built but not triggered in this migration
        # Future use: member agent will decide what to do based on user message
    except ValidationError as e:
        # Removed logger call - Socket.IO handles logging
        await member_generate_error(
            MemberGenerateErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def member_generate_api(request: MemberGeneratePayload) -> dict[str, bool]:
    """Client-to-server event: Generate member agent response (unused in this migration)."""
    return {"success": True}


@server_router.post("/generate_error", response_model=dict[str, bool])
async def member_generate_error_api(
    request: MemberGenerateErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in member generation."""
    return {"success": True}


register_server_endpoint(
    client_router,
    "/generate",
    MemberGeneratePayload,
    "Generate member agent response (unused in this migration)",
)
