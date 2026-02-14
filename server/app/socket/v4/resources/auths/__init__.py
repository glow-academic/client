"""Auths resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.auths.types import AuthsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/auths_generation_complete")
async def auths_generation_complete_api(
    request: AuthsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Auths generation completed."""
    return {"success": True}


@server_router.post("/auths_generation_started")
async def auths_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Auths generation started."""
    return {"success": True}


@server_router.post("/auths_generation_progress")
async def auths_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Auths generation progress."""
    return {"success": True}


@server_router.post("/auths_generation_error")
async def auths_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Auths generation error."""
    return {"success": True}
