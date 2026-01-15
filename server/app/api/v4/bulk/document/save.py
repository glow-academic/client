"""Document bulk save endpoint - bulk create or update documents."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    SaveDocumentApiRequest,
    SaveDocumentApiResponse,
    SaveDocumentSqlParams,
    SaveDocumentSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/documents/save_document_complete.sql"

router = APIRouter()


@router.post(
    "/save",
    response_model=SaveDocumentApiResponse,
    dependencies=[
        audit_activity(
            "document.saved",
            "{{ actor.name }} {% if document %}updated{% else %}created{% endif %} document{% if document %} '{{ document.name }}'{% endif %}",
        )
    ],
)
async def bulk_save_documents(
    request: SaveDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveDocumentApiResponse:
    """Bulk create or update documents."""
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
            params = SaveDocumentSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveDocumentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.document_id:
                raise ValueError("Failed to save document")

            # Set audit context
            audit_set(
                http_request,
                actor={"id": profile_id},
                document={"id": str(result.document_id)},
            )

        # Convert SQL result to API response
        api_response = SaveDocumentApiResponse.model_validate(result.model_dump())

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
            operation="bulk_save_documents",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
