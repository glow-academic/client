"""Model update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdateModelRequest(BaseModel):
    """Request to update model."""

    modelId: str
    provider: str  # enum: 'openai', 'gemini', 'custom'
    model_type: str  # enum: 'text', 'audio', 'video' (immutable after creation)
    name: str
    description: str
    active: bool
    image_model: bool
    input_ppm: float
    output_ppm: float
    department_ids: list[str] | None = None
    key_id: str | None = None
    base_url: str | None = None  # Required if provider is 'custom'
    profileId: str  # Required for auditing/access control


class UpdateModelResponse(BaseModel):
    """Response from update model."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateModelResponse)
async def update_model(
    request: UpdateModelRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateModelResponse:
    """Update an existing model."""
    tags = ["models"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if model exists and get current model_type
            check_sql = "SELECT name, model_type FROM models WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.modelId)

            if not existing:
                raise ValueError(f"Model not found: {request.modelId}")
            
            # Validate: model_type cannot be changed after creation
            current_model_type = existing.get("model_type")
            if current_model_type and current_model_type != request.model_type:
                raise ValueError(f"Model type cannot be changed after creation. Current type: {current_model_type}, requested: {request.model_type}")
            
            # Validate model_type
            if request.model_type not in ["text", "audio", "video"]:
                raise ValueError(f"Invalid model_type: {request.model_type}. Must be 'text', 'audio', or 'video'")

            # Update model with departments, keys, and endpoints (track primary operation)
            # Note: model_type is not updated (immutable after creation)
            sql_query = load_sql("sql/v3/models/update_model_complete.sql")
            # Ensure department_ids is always an array (empty if None)
            department_ids = request.department_ids if request.department_ids else []
            sql_params = (
                request.modelId,
                request.provider,
                request.name,
                request.description,
                request.active,
                request.image_model,
                request.input_ppm,
                request.output_ppm,
                department_ids,
                request.key_id,
                request.base_url,
                request.profileId,
            )
            await conn.execute(
                sql_query,
                request.modelId,
                request.provider,
                request.name,
                request.description,
                request.active,
                request.image_model,
                request.input_ppm,
                request.output_ppm,
                department_ids,
                request.key_id,
                request.base_url,
                request.profileId,
            )

            result_data = UpdateModelResponse(
                success=True,
                message=f"Model '{request.name}' updated successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

