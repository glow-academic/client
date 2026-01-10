"""content endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (ContentApiRequest,
                           ContentApiResponse,
                           ContentSqlParams, ContentSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/resources/content_complete.sql"


router = APIRouter()


@router.post(
    "/content",
    response_model=ContentApiResponse,
    dependencies=[
        audit_activity(
            "content.created",
            "{{ actor.name }} created content",
        )
    ],
)
async def create_content(
    request: ContentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ContentApiResponse:
    """Create content resource (always INSERT)."""
    tags = ["resources", "content"]

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
            # Frontend sends snake_case (content) - auto-generated types match SQL function signature
            # Get mcp flag from header (set by router-level dependency)
            mcp = getattr(http_request.state, 'mcp', False) or False
            
            # Convert API request to SQL params (use double star pattern)
            # Add mcp from header (not in request body)
            request_dict = request.model_dump()
            request_dict['mcp'] = mcp
            params = ContentSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                ContentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.content_id:
                raise ValueError("Failed to create content")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                content={"id": str(result.content_id)},
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = ContentApiResponse.model_validate(result.model_dump())

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
            operation="create_content",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
