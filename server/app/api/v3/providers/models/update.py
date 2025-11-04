"""Model update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateModelResponse:
    """Update an existing model."""
    tags = ["providers"]  # From router tags
    
    try:
        async with transaction(conn):
            # Check if model exists
            check_sql = "SELECT name FROM models WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.modelId)

            if not existing:
                raise ValueError(f"Model not found: {request.modelId}")

            # Update model
            update_sql = load_sql("sql/v3/providers/update_model.sql")
            await conn.execute(
                update_sql,
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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

