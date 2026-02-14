"""Roles resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.roles.types import RolesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/roles_generation_complete")
async def roles_generation_complete_api(
    request: RolesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Roles generation completed."""
    return {"success": True}


@server_router.post("/roles_generation_started")
async def roles_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Roles generation started."""
    return {"success": True}


@server_router.post("/roles_generation_progress")
async def roles_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Roles generation progress."""
    return {"success": True}


@server_router.post("/roles_generation_error")
async def roles_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Roles generation error."""
    return {"success": True}
