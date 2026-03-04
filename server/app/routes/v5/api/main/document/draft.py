"""Document draft endpoint - handles autosave for all document resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.main.document.types import (
    PatchDocumentDraftApiRequest,
    PatchDocumentDraftApiResponse,
    PatchDocumentDraftSqlParams,
)
from app.sql.types import (
    PatchDocumentDraftSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/documents/patch_document_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchDocumentDraftApiResponse,
)
async def patch_document_draft(
    request: PatchDocumentDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchDocumentDraftApiResponse:
    """Patch document draft - accepts resource actions and creates/updates draft."""
    tags = ["documents", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = PatchDocumentDraftSqlParams.from_request(request, profile_id)
            sql_params = params.to_tuple()

            result = cast(
                PatchDocumentDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch document draft")

        api_response = PatchDocumentDraftApiResponse(
            success=True,
            draft_id=result.draft_id,
            new_version=result.new_version,
            message="Draft updated successfully",
        )

        await invalidate_tags(tags, redis=get_redis_client())
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
            operation="patch_document_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
