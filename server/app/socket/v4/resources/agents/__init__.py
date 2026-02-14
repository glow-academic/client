"""Agents resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.agents.types import AgentsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/agents_generation_complete")
async def agents_generation_complete_api(
    request: AgentsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Agents generation completed."""
    return {"success": True}


@server_router.post("/agents_generation_started")
async def agents_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Agents generation started."""
    return {"success": True}


@server_router.post("/agents_generation_progress")
async def agents_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Agents generation progress."""
    return {"success": True}


@server_router.post("/agents_generation_error")
async def agents_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Agents generation error."""
    return {"success": True}
