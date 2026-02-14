"""Parameters resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.parameters.types import ParametersGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/parameters_generation_complete")
async def parameters_generation_complete_api(
    request: ParametersGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameters generation completed."""
    return {"success": True}


@server_router.post("/parameters_generation_started")
async def parameters_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameters generation started."""
    return {"success": True}


@server_router.post("/parameters_generation_progress")
async def parameters_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameters generation progress."""
    return {"success": True}


@server_router.post("/parameters_generation_error")
async def parameters_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameters generation error."""
    return {"success": True}
