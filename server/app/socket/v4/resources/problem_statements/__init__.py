"""ProblemStatements resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.problem_statements.types import ProblemStatementsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/problem_statements_generation_complete")
async def problem_statements_generation_complete_api(
    request: ProblemStatementsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProblemStatements generation completed."""
    return {"success": True}


@server_router.post("/problem_statements_generation_started")
async def problem_statements_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProblemStatements generation started."""
    return {"success": True}


@server_router.post("/problem_statements_generation_progress")
async def problem_statements_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProblemStatements generation progress."""
    return {"success": True}


@server_router.post("/problem_statements_generation_error")
async def problem_statements_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: ProblemStatements generation error."""
    return {"success": True}
