"""Protocols resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.protocols.types import ProtocolsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/protocols_generation_complete")
async def protocols_generation_complete_api(
    request: ProtocolsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Protocols generation completed."""
    return {"success": True}


@server_router.post("/protocols_generation_started")
async def protocols_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Protocols generation started."""
    return {"success": True}


@server_router.post("/protocols_generation_progress")
async def protocols_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Protocols generation progress."""
    return {"success": True}


@server_router.post("/protocols_generation_error")
async def protocols_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Protocols generation error."""
    return {"success": True}
