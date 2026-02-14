"""ConditionalParameters resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.conditional_parameters.types import ConditionalParametersGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/conditional_parameters_generation_complete")
async def conditional_parameters_generation_complete_api(
    request: ConditionalParametersGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ConditionalParameters generation completed."""
    return {"success": True}


@server_router.post("/conditional_parameters_generation_started")
async def conditional_parameters_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ConditionalParameters generation started."""
    return {"success": True}


@server_router.post("/conditional_parameters_generation_progress")
async def conditional_parameters_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ConditionalParameters generation progress."""
    return {"success": True}


@server_router.post("/conditional_parameters_generation_error")
async def conditional_parameters_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ConditionalParameters generation error."""
    return {"success": True}
