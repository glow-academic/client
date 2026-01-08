"""images endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (ImagesApiRequest,
                           ImagesApiResponse,
                           ImagesSqlParams, ImagesSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/resources/images_complete.sql"


router = APIRouter()


@router.post(
    "/images",
    response_model=ImagesApiResponse,
    dependencies=[
        audit_activity(
            "images.created",
            "{{ actor.name }} created images",
        )
    ],
)
async def create_image(
    request: ImagesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ImagesApiResponse:
    """Create images resource (always INSERT)."""
    tags = ["resources", "images"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (use double star pattern)
            # Frontend sends snake_case (name, description) - auto-generated types match SQL function signature
            params = ImagesSqlParams(**request.model_dump())
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                ImagesSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.image_id:
                raise ValueError("Failed to create images")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                images={"id": str(result.image_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = ImagesApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_image",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
