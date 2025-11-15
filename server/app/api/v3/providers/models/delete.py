"""Model delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteModelResponse:
    """Delete a model if not in use."""
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Delete model with usage checks and name fetch (single query)
            sql_query = load_sql("sql/v3/providers/delete_model_complete.sql")
            sql_params = (request.modelId,)
            result = await conn.fetchrow(sql_query, request.modelId)

            if not result:
                raise ValueError("Failed to check model usage")

            personas_usage_count = result.get("personas_usage_count", 0)
            agents_usage_count = result.get("agents_usage_count", 0)

            if personas_usage_count > 0:
                raise ValueError("Cannot delete model: It is in use by personas")

            if agents_usage_count > 0:
                raise ValueError("Cannot delete model: It is in use by agents")

            if not result.get("deleted"):
                raise ValueError(f"Model not found: {request.modelId}")

            model_name = result.get("name", "Unknown")

            result_data = DeleteModelResponse(
                success=True,
                message=f"Model '{model_name}' deleted successfully",
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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
