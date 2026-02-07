"""Document bulk delete endpoint - bulk delete documents."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteDocumentApiRequest,
    DeleteDocumentApiResponse,
    DeleteDocumentSqlParams,
    DeleteDocumentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/documents/delete_document_complete.sql"

router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteDocumentApiResponse,
    dependencies=[
        audit_activity(
            "document.deleted", "{{ actor.name }} deleted {{ count }} document(s)"
        )
    ],
)
async def delete_document(
    request: DeleteDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDocumentApiResponse:
    """Bulk delete documents."""
    tags = ["documents"]

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
            # Convert API request to SQL params
            params = DeleteDocumentSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DeleteDocumentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to delete documents")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                document={"count": result.count if hasattr(result, "count") else 1},
            )

        # Convert SQL result to API response
        api_response = DeleteDocumentApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
