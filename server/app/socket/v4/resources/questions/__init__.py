"""Questions resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.questions.types import QuestionsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/questions_generation_complete")
async def questions_generation_complete_api(
    request: QuestionsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Questions generation completed."""
    return {"success": True}


@server_router.post("/questions_generation_started")
async def questions_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Questions generation started."""
    return {"success": True}


@server_router.post("/questions_generation_progress")
async def questions_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Questions generation progress."""
    return {"success": True}


@server_router.post("/questions_generation_error")
async def questions_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Questions generation error."""
    return {"success": True}
