"""Draft get endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetDraftApiRequest,
    GetDraftApiResponse,
    GetDraftSqlParams,
    GetDraftSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/drafts/get_draft_complete.sql"


router = APIRouter()


@router.get(
    "/{draft_id}",
    response_model=GetDraftApiResponse,
    dependencies=[
        audit_activity(
            "draft.viewed",
            "{{ actor.name }} viewed draft",
        )
    ],
)
async def get_draft(
    draft_id: UUID,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDraftApiResponse:
    """Get draft metadata."""
    tags = ["drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert draft_id to API request (for type consistency)
        request = GetDraftApiRequest(draft_id=draft_id)

        # Convert API request to SQL params
        params = GetDraftSqlParams(**request.model_dump())
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetDraftSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result or not result.draft_exists:
            raise HTTPException(
                status_code=404,
                detail="Draft not found",
            )

        # Convert SQL result to API response (auto-generated types)
        api_response = GetDraftApiResponse.model_validate(result.model_dump())

        # Set cache tags for reads
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
