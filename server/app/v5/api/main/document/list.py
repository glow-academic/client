"""Document list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with active_scenario_count and total_scenario_links
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.document.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.v5.api.main.document.types import (
    ListDocumentApiDocument,
    ListDocumentApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.resources.uploads.get import get_uploads_internal
from app.v5.api.types import ListFilterSection
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    GetDocumentsListApiRequest,
    GetDocumentsListSqlParams,
    GetDocumentsListSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/v5/sql/queries/documents/get_documents_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListDocumentApiResponse)
async def get_document_list(
    request: GetDocumentsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListDocumentApiResponse:
    """Get documents list with permissions and scenario details."""
    tags = ["documents"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListDocumentApiResponse.model_validate(cached["data"])

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

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = GetDocumentsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            field_ids=request.field_ids,
            filter_department_ids=request.filter_department_ids,
            scenario_search=request.scenario_search,
            field_search=request.field_search,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetDocumentsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # user_role already fetched from context above

        # Compute permissions for each document in Python
        documents_with_permissions: list[ListDocumentApiDocument] = []
        for doc in result.documents or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                document_department_ids=doc.department_ids,
                active_scenario_count=doc.active_scenario_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                document_department_ids=doc.department_ids,
                active_scenario_count=doc.active_scenario_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            documents_with_permissions.append(
                ListDocumentApiDocument(
                    document_id=doc.document_id,
                    name=doc.name,
                    department_ids=doc.department_ids,
                    scenario_ids=doc.scenario_ids,
                    field_ids=doc.field_ids,
                    is_inactive=doc.is_inactive,
                    num_scenarios=doc.num_scenarios,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=doc.updated_at,
                )
            )

        # --- Collect upload resource IDs for Pass 2 hydration ---
        all_upload_resource_ids: list[UUID] = []
        for doc in result.documents or []:
            if doc.upload_ids:
                all_upload_resource_ids.extend(doc.upload_ids)
        # Deduplicate
        all_upload_resource_ids = list(set(all_upload_resource_ids))

        # --- Fetch upload resources for file ID hydration ---
        uploads_data: list = []

        pool = get_pool()
        if pool and all_upload_resource_ids:

            async def fetch_uploads() -> list:
                if not all_upload_resource_ids:
                    return []
                async with pool.acquire() as c:
                    return await get_uploads_internal(
                        c, all_upload_resource_ids, bypass_cache
                    )

            uploads_data = await fetch_uploads()

        # Build uploads_id -> upload_id map (resource ID -> file ID for download URL)
        upload_resource_to_file_id: dict[UUID, UUID] = {}
        for u in uploads_data:
            if u.uploads_id and u.upload_id:
                uid = (
                    UUID(str(u.uploads_id))
                    if not isinstance(u.uploads_id, UUID)
                    else u.uploads_id
                )
                upload_resource_to_file_id[uid] = u.upload_id

        # Hydrate upload_id onto documents
        for doc_api in documents_with_permissions:
            # Find the matching SQL doc to get upload_ids
            matching_sql_doc = next(
                (
                    d
                    for d in (result.documents or [])
                    if d.document_id == doc_api.document_id
                ),
                None,
            )
            if matching_sql_doc and matching_sql_doc.upload_ids:
                for resource_id in matching_sql_doc.upload_ids:
                    rid = (
                        UUID(str(resource_id))
                        if not isinstance(resource_id, UUID)
                        else resource_id
                    )
                    file_id = upload_resource_to_file_id.get(rid)
                    if file_id:
                        doc_api.upload_id = file_id
                        break

        # Build API response with filter sections (names resolved in SQL)
        api_response = ListDocumentApiResponse(
            actor_name=actor_name,
            documents=documents_with_permissions,
            scenario_filter=ListFilterSection.from_sql_options(
                result.scenario_options,
                request.scenario_ids,
                request.scenario_search,
            ),
            field_filter=ListFilterSection.from_sql_options(
                result.field_options,
                request.field_ids,
                request.field_search,
            ),
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            total_count=result.total_count,
        )

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
            operation="get_document_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
