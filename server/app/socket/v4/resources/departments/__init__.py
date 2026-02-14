"""Departments resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.departments.types import DepartmentsGenerationCompleteEvent
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/departments_generation_complete")
async def departments_generation_complete_api(
    request: DepartmentsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Departments generation completed."""
    return {"success": True}


@server_router.post("/departments_generation_started")
async def departments_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Departments generation started."""
    return {"success": True}


@server_router.post("/departments_generation_progress")
async def departments_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Departments generation progress."""
    return {"success": True}


@server_router.post("/departments_generation_error")
async def departments_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Departments generation error."""
    return {"success": True}
