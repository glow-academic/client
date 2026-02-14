"""Emails resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.emails.types import EmailsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/emails_generation_complete")
async def emails_generation_complete_api(
    request: EmailsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Emails generation completed."""
    return {"success": True}


@server_router.post("/emails_generation_started")
async def emails_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Emails generation started."""
    return {"success": True}


@server_router.post("/emails_generation_progress")
async def emails_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Emails generation progress."""
    return {"success": True}


@server_router.post("/emails_generation_error")
async def emails_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Emails generation error."""
    return {"success": True}
