"""Profiles resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.profiles.types import ProfilesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/profiles_generation_complete")
async def profiles_generation_complete_api(
    request: ProfilesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Profiles generation completed."""
    return {"success": True}


@server_router.post("/profiles_generation_started")
async def profiles_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Profiles generation started."""
    return {"success": True}


@server_router.post("/profiles_generation_progress")
async def profiles_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Profiles generation progress."""
    return {"success": True}


@server_router.post("/profiles_generation_error")
async def profiles_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Profiles generation error."""
    return {"success": True}
