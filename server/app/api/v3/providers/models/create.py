"""Model create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateModelRequest(BaseModel):
    """Request to create model."""

    provider_id: str
    name: str
    description: str
    active: bool
    custom_model: bool
    image_model: bool
    input_ppm: float
    output_ppm: float


class CreateModelResponse(BaseModel):
    """Response from create model."""

    success: bool
    modelId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateModelResponse)
async def create_model(
    request: CreateModelRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateModelResponse:
    """Create a new model."""
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            sql_query = load_sql("sql/v3/providers/create_model.sql")
            sql_params = (
                request.provider_id,
                request.name,
                request.description,
                request.active,
                request.custom_model,
                request.image_model,
                request.input_ppm,
                request.output_ppm,
            )
            result = await conn.fetchrow(
                sql_query,
                request.provider_id,
                request.name,
                request.description,
                request.active,
                request.custom_model,
                request.image_model,
                request.input_ppm,
                request.output_ppm,
            )

            if not result:
                raise ValueError("Failed to create model")

            model_id = str(result["id"])

            result_data = CreateModelResponse(
                success=True,
                modelId=model_id,
                message=f"Model '{request.name}' created successfully",
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
            operation="create_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
