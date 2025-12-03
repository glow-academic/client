"""Image create endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


# Inline request/response schemas
class CreateImageRequest(BaseModel):
    """Request to create image."""

    name: str
    uploadId: str


class CreateImageResponse(BaseModel):
    """Response from create image."""

    success: bool
    message: str
    imageId: str | None = None


@router.post("/create", response_model=CreateImageResponse)
async def create_image(
    request_body: CreateImageRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateImageResponse:
    """Create a new image."""
    tags = ["images"]
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        image_id = uuid.uuid4()

        sql_query = load_sql("sql/v3/images/insert_image_complete.sql")
        sql_params = (
            image_id,
            request_body.name,
            uuid.UUID(request_body.uploadId),
        )

        result = await conn.fetchrow(
            sql_query,
            image_id,
            request_body.name,
            uuid.UUID(request_body.uploadId),
        )

        if not result:
            raise ValueError("Failed to create image")

        image_id_str = result["image_id"]

        result_data = CreateImageResponse(
            success=True,
            message="Image created successfully",
            imageId=image_id_str,
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="create_image",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
        return CreateImageResponse(
            success=False,
            message=f"Failed to create image: {str(e)}",
        )

