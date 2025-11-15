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
    name: str
    description: str
    active: bool
    custom_model: bool
    image_model: bool
    input_ppm: float
    output_ppm: float


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
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if model exists
            check_sql = "SELECT name FROM models WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.modelId)

            if not existing:
                raise ValueError(f"Model not found: {request.modelId}")

            # Update model (track primary operation)
            sql_query = load_sql("sql/v3/providers/update_model.sql")
            sql_params = (
                request.modelId,
                request.name,
                request.description,
                request.active,
                request.custom_model,
                request.image_model,
                request.input_ppm,
                request.output_ppm,
            )
            await conn.execute(
                sql_query,
                request.modelId,
                request.name,
                request.description,
                request.active,
                request.custom_model,
                request.image_model,
                request.input_ppm,
                request.output_ppm,
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
