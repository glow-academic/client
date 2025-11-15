"""Model duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateModelResponse:
    """Duplicate a model."""
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

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

            # Duplicate model (SQL adds ' Copy' to description) - track primary operation
            sql_query = load_sql("sql/v3/providers/duplicate_model.sql")
            sql_params = (request.modelId,)
            new_model = await conn.fetchrow(sql_query, request.modelId)

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
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
