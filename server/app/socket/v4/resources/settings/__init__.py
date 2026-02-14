"""Settings resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.settings.types import SettingsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/settings_generation_complete")
async def settings_generation_complete_api(
    request: SettingsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Settings generation completed."""
    return {"success": True}


@server_router.post("/settings_generation_started")
async def settings_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Settings generation started."""
    return {"success": True}


@server_router.post("/settings_generation_progress")
async def settings_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Settings generation progress."""
    return {"success": True}


@server_router.post("/settings_generation_error")
async def settings_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Settings generation error."""
    return {"success": True}
