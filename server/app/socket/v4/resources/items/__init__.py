"""Items resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.items.types import ItemsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/items_generation_complete")
async def items_generation_complete_api(
    request: ItemsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Items generation completed."""
    return {"success": True}


@server_router.post("/items_generation_started")
async def items_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Items generation started."""
    return {"success": True}


@server_router.post("/items_generation_progress")
async def items_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Items generation progress."""
    return {"success": True}


@server_router.post("/items_generation_error")
async def items_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Items generation error."""
    return {"success": True}
