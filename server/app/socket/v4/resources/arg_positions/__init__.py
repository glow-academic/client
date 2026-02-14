"""ArgPositions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.arg_positions.types import ArgPositionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/arg_positions_generation_complete")
async def arg_positions_generation_complete_api(
    request: ArgPositionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgPositions generation completed."""
    return {"success": True}


@server_router.post("/arg_positions_generation_started")
async def arg_positions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgPositions generation started."""
    return {"success": True}


@server_router.post("/arg_positions_generation_progress")
async def arg_positions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgPositions generation progress."""
    return {"success": True}


@server_router.post("/arg_positions_generation_error")
async def arg_positions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgPositions generation error."""
    return {"success": True}
