"""Descriptions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.descriptions.types import (
    DescriptionsGenerationCompleteEvent,
)
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/descriptions_generation_complete")
async def descriptions_generation_complete_api(
    request: DescriptionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Descriptions generation completed."""
    return {"success": True}


@server_router.post("/descriptions_generation_started")
async def descriptions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Descriptions generation started."""
    return {"success": True}


@server_router.post("/descriptions_generation_progress")
async def descriptions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Descriptions generation progress."""
    return {"success": True}


@server_router.post("/descriptions_generation_error")
async def descriptions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Descriptions generation error."""
    return {"success": True}
