"""Evals resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.evals.types import EvalsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/evals_generation_complete")
async def evals_generation_complete_api(
    request: EvalsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Evals generation completed."""
    return {"success": True}


@server_router.post("/evals_generation_started")
async def evals_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Evals generation started."""
    return {"success": True}


@server_router.post("/evals_generation_progress")
async def evals_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Evals generation progress."""
    return {"success": True}


@server_router.post("/evals_generation_error")
async def evals_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Evals generation error."""
    return {"success": True}
