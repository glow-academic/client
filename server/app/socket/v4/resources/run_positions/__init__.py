"""RunPositions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.run_positions.types import RunPositionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/run_positions_generation_complete")
async def run_positions_generation_complete_api(
    request: RunPositionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunPositions generation completed."""
    return {"success": True}


@server_router.post("/run_positions_generation_started")
async def run_positions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunPositions generation started."""
    return {"success": True}


@server_router.post("/run_positions_generation_progress")
async def run_positions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunPositions generation progress."""
    return {"success": True}


@server_router.post("/run_positions_generation_error")
async def run_positions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunPositions generation error."""
    return {"success": True}
