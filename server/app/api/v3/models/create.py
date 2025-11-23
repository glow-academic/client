"""Model create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class CreateModelRequest(BaseModel):
    """Request to create model."""

    provider: str  # enum: 'openai', 'gemini', 'custom'
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
    tags = ["models"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            sql_query = load_sql("sql/v3/models/create_model_complete.sql")
            # Ensure department_ids is always an array (empty if None)
            department_ids = request.department_ids if request.department_ids else []
            sql_params = (
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
            result = await conn.fetchrow(
                sql_query,
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

