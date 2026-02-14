"""GroupRubrics resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.group_rubrics.types import GroupRubricsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/group_rubrics_generation_complete")
async def group_rubrics_generation_complete_api(
    request: GroupRubricsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupRubrics generation completed."""
    return {"success": True}


@server_router.post("/group_rubrics_generation_started")
async def group_rubrics_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupRubrics generation started."""
    return {"success": True}


@server_router.post("/group_rubrics_generation_progress")
async def group_rubrics_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupRubrics generation progress."""
    return {"success": True}


@server_router.post("/group_rubrics_generation_error")
async def group_rubrics_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: GroupRubrics generation error."""
    return {"success": True}
