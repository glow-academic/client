"""Documents resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.documents.types import DocumentsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/documents_generation_complete")
async def documents_generation_complete_api(
    request: DocumentsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Documents generation completed."""
    return {"success": True}


@server_router.post("/documents_generation_started")
async def documents_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Documents generation started."""
    return {"success": True}


@server_router.post("/documents_generation_progress")
async def documents_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Documents generation progress."""
    return {"success": True}


@server_router.post("/documents_generation_error")
async def documents_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Documents generation error."""
    return {"success": True}
