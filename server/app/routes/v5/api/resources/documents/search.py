"""Documents SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.documents.search import (
    SQL_PATH,
    search_documents_internal,
)
from app.sql.types import (
    SearchDocumentsApiRequest,
    SearchDocumentsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/documents/search",
    response_model=SearchDocumentsApiResponse,
)
async def search_documents(
    request: SearchDocumentsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchDocumentsApiResponse:
    tags = ["resources", "documents"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_documents_internal(
            conn,
            search=request.search,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            department_ids=request.department_ids,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            upload_ids=request.upload_ids,
            text_ids=request.text_ids,
            image_ids=request.image_ids,
            template=request.template,
            bypass_cache=bypass_cache,
            document=request.document or False,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDocumentsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_documents",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
