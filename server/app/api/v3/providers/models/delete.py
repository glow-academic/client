"""Model delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DeleteModelRequest(BaseModel):
    """Request to delete model."""

    modelId: str


class DeleteModelResponse(BaseModel):
    """Response from delete model."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteModelResponse)
async def delete_model(
    request: DeleteModelRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteModelResponse:
    """Delete a model if not in use."""
    tags = ["providers"]  # From router tags
    
    try:
        async with transaction(conn):
            # Check if model is in use by personas
            personas_usage_sql = load_sql("sql/v3/providers/check_model_usage_in_personas.sql")
            personas_usage = await conn.fetchrow(personas_usage_sql, request.modelId)

            if personas_usage and personas_usage.get("usage_count", 0) > 0:
                raise ValueError("Cannot delete model: It is in use by personas")

            # Check if model is in use by agents
            agents_usage_sql = load_sql("sql/v3/providers/check_model_usage_in_agents.sql")
            agents_usage = await conn.fetchrow(agents_usage_sql, request.modelId)

            if agents_usage and agents_usage.get("usage_count", 0) > 0:
                raise ValueError("Cannot delete model: It is in use by agents")

            # Get model name
            get_name_sql = "SELECT name FROM models WHERE id = $1"
            model = await conn.fetchrow(get_name_sql, request.modelId)

            if not model:
                raise ValueError(f"Model not found: {request.modelId}")

            # Delete model
            delete_sql = load_sql("sql/v3/providers/delete_model.sql")
            await conn.execute(delete_sql, request.modelId)

            result_data = DeleteModelResponse(
                success=True,
                message=f"Model '{model['name']}' deleted successfully",
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

