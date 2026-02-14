"""ArgsOutputs resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.args_outputs.types import ArgsOutputsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/args_outputs_generation_complete")
async def args_outputs_generation_complete_api(
    request: ArgsOutputsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgsOutputs generation completed."""
    return {"success": True}


@server_router.post("/args_outputs_generation_started")
async def args_outputs_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgsOutputs generation started."""
    return {"success": True}


@server_router.post("/args_outputs_generation_progress")
async def args_outputs_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgsOutputs generation progress."""
    return {"success": True}


@server_router.post("/args_outputs_generation_error")
async def args_outputs_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ArgsOutputs generation error."""
    return {"success": True}
