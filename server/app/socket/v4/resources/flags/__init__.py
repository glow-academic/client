"""Flags resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.flags.types import FlagsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/flags_generation_complete")
async def flags_generation_complete_api(
    request: FlagsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Flags generation completed."""
    return {"success": True}


@server_router.post("/flags_generation_started")
async def flags_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Flags generation started."""
    return {"success": True}


@server_router.post("/flags_generation_progress")
async def flags_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Flags generation progress."""
    return {"success": True}


@server_router.post("/flags_generation_error")
async def flags_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Flags generation error."""
    return {"success": True}
