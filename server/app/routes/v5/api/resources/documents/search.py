"""Documents SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.documents.search import (
    search_documents as search_documents_fn,
)
from app.sql.types import (
    QGetDocumentsV4Item,
    SearchDocumentsApiRequest,
    SearchDocumentsApiResponse,
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
        items = await search_documents_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
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
        # Map GetDocumentResponse -> QGetDocumentsV4Item for API compatibility
        api_items = [
            QGetDocumentsV4Item(
                document_id=i.id,
                name=i.name,
                description=i.description,
                generated=i.generated,
                upload_id=i.upload_id,
                text_id=i.text_id,
                image_ids=i.image_ids,
                template=i.template,
                parameter_field_ids=i.parameter_field_ids,
                parameter_ids=i.parameter_ids,
            )
            for i in items
        ]
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDocumentsApiResponse(items=api_items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_documents",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
