"""Parameter fields resource socket events - OpenAPI schema endpoints."""

from fastapi import APIRouter

from app.socket.v4.resources.parameter_fields.types import (
    ParameterFieldsGenerationCompleteEvent,
)
from app.socket.v4.resources.types import (
    ResourceErrorEvent,
    ResourceProgressEvent,
    ResourceStartEvent,
)

server_router = APIRouter()


@server_router.post("/parameter_fields_generation_complete")
async def parameter_fields_generation_complete_api(
    request: ParameterFieldsGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameter fields generation completed."""
    return {"success": True}


@server_router.post("/parameter_fields_generation_started")
async def parameter_fields_generation_started_api(
    request: ResourceStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameter fields generation started."""
    return {"success": True}


@server_router.post("/parameter_fields_generation_progress")
async def parameter_fields_generation_progress_api(
    request: ResourceProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameter fields generation progress."""
    return {"success": True}


@server_router.post("/parameter_fields_generation_error")
async def parameter_fields_generation_error_api(
    request: ResourceErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Parameter fields generation error."""
    return {"success": True}
