"""Personas resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.personas.types import PersonasGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/personas_generation_complete")
async def personas_generation_complete_api(
    request: PersonasGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Personas generation completed."""
    return {"success": True}


@server_router.post("/personas_generation_started")
async def personas_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Personas generation started."""
    return {"success": True}


@server_router.post("/personas_generation_progress")
async def personas_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Personas generation progress."""
    return {"success": True}


@server_router.post("/personas_generation_error")
async def personas_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Personas generation error."""
    return {"success": True}
