"""RoleRoutes resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.role_routes.types import RoleRoutesGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/role_routes_generation_complete")
async def role_routes_generation_complete_api(
    request: RoleRoutesGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: RoleRoutes generation completed."""
    return {"success": True}


@server_router.post("/role_routes_generation_started")
async def role_routes_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: RoleRoutes generation started."""
    return {"success": True}


@server_router.post("/role_routes_generation_progress")
async def role_routes_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: RoleRoutes generation progress."""
    return {"success": True}


@server_router.post("/role_routes_generation_error")
async def role_routes_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: RoleRoutes generation error."""
    return {"success": True}
