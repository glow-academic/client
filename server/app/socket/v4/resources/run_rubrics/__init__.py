"""RunRubrics resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.run_rubrics.types import RunRubricsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/run_rubrics_generation_complete")
async def run_rubrics_generation_complete_api(
    request: RunRubricsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunRubrics generation completed."""
    return {"success": True}


@server_router.post("/run_rubrics_generation_started")
async def run_rubrics_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunRubrics generation started."""
    return {"success": True}


@server_router.post("/run_rubrics_generation_progress")
async def run_rubrics_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunRubrics generation progress."""
    return {"success": True}


@server_router.post("/run_rubrics_generation_error")
async def run_rubrics_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: RunRubrics generation error."""
    return {"success": True}
