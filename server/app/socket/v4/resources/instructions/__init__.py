"""Instructions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.instructions.types import (
    InstructionsGenerationCompleteEvent,
)
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/instructions_generation_complete")
async def instructions_generation_complete_api(
    request: InstructionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Instructions generation completed."""
    return {"success": True}


@server_router.post("/instructions_generation_started")
async def instructions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Instructions generation started."""
    return {"success": True}


@server_router.post("/instructions_generation_progress")
async def instructions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Instructions generation progress."""
    return {"success": True}


@server_router.post("/instructions_generation_error")
async def instructions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Instructions generation error."""
    return {"success": True}
