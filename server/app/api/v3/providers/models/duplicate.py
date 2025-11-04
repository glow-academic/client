"""Model duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DuplicateModelRequest(BaseModel):
    """Request to duplicate model."""

    modelId: str


class DuplicateModelResponse(BaseModel):
    """Response from duplicate model."""

    success: bool
    modelId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateModelResponse)
async def duplicate_model(
    request: DuplicateModelRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateModelResponse:
    """Duplicate a model."""
    tags = ["providers"]  # From router tags
    
    try:
        async with transaction(conn):
            # Get original model data
            get_model_sql = """
                SELECT 
                    name,
                    description,
                    active,
                    custom_model,
                    image_model,
                    input_ppm,
                    output_ppm,
                    provider_id
                FROM models
                WHERE id = $1
            """
            model = await conn.fetchrow(get_model_sql, request.modelId)

            if not model:
                raise ValueError(f"Model not found: {request.modelId}")

            # Duplicate model (SQL adds ' Copy' to description)
            duplicate_sql = load_sql("sql/v3/providers/duplicate_model.sql")
            new_model = await conn.fetchrow(duplicate_sql, request.modelId)

            if not new_model:
                raise ValueError("Failed to create duplicate model")

            new_model_id = str(new_model["id"])

            result_data = DuplicateModelResponse(
                success=True,
                modelId=new_model_id,
                message=f"Model '{model['name']}' duplicated successfully",
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

