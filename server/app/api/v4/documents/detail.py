"""Document detail endpoint - v4 API."""

import os
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import UPLOAD_FOLDER, get_db
from app.sql.types import (
    GetDocumentDetailApiRequest,
    GetDocumentDetailApiResponse,
    GetDocumentDetailSqlParams,
    GetDocumentDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/documents/get_document_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetDocumentDetailApiResponse,
    dependencies=[
        audit_activity(
            "document.viewed", "{{ actor.name }} viewed document '{{ document.name }}'"
        )
    ],
)
async def get_document_detail(
    request: GetDocumentDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDocumentDetailApiResponse:
    """Get document detail information."""
    tags = ["documents"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetDocumentDetailApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetDocumentDetailSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetDocumentDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if document exists and has access using SQL result
        # SQL now returns document_exists field to distinguish 404 vs 403
        if not result.document_exists:
            raise HTTPException(
                status_code=404, detail=f"Document {request.document_id} not found"
            )

        if not result.name:
            # Document exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this document. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        actor_name = result.actor_name
        document_name = result.name
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                document={"name": document_name, "id": str(request.document_id)},
            )

        # Read template HTML if template upload exists (keep this in Python for now)
        template_html: str | None = None
        if result.template and result.template_upload_id:
            try:
                if result.template_file_path:
                    full_path = os.path.join(UPLOAD_FOLDER, result.template_file_path)
                    if os.path.exists(full_path):
                        with open(full_path, encoding="utf-8") as f:
                            template_html = f.read()
            except Exception:
                # If reading fails, template_html will remain None
                pass

        # Convert SQL result to API response
        # Update template_html from file system
        response_dict = result.model_dump()
        if template_html is not None:
            response_dict["template_html"] = template_html
        api_response = GetDocumentDetailApiResponse.model_validate(response_dict)

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_document_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
