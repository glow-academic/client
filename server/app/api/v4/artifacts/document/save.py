"""Document save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (document_id = NULL) and update (document_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.document.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.document.types import (
    SaveDocumentApiRequest,
    SaveDocumentApiResponse,
    SaveDocumentSqlParams,
    SaveDocumentSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckDocumentSaveAccessSqlParams,
    CheckDocumentSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/documents/check_document_save_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/documents/save_document_complete.sql"


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
async def save_document(
    request: SaveDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveDocumentApiResponse:
    """Save document - handles both create (input_document_id = NULL) and update (input_document_id provided)."""
    tags = ["documents"]  # From router tags

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

        # Fetch user context for permissions and audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
                user_department_ids = [
                    d.department_id
                    for d in resolved_context.departments
                    if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get user role and document info using typed SQL
        access_params = CheckDocumentSaveAccessSqlParams(
            profile_id=profile_id,
            document_id=request.input_document_id,
        )
        access_result = cast(
            CheckDocumentSaveAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_CHECK_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        # Permission logic: create vs update mode
        if not request.input_document_id:
            # Create mode: check role and department permissions
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=None,  # Will be validated when saving from draft
            )
        else:
            # Update mode: full permission check
            can_save_result = compute_can_save(
                user_role=user_role,
                user_department_ids=user_department_ids,
                document_department_ids=access_result.document_department_ids,
                active_scenario_count=access_result.active_scenario_count or 0,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this document.",
            )

        async with conn.transaction():
            # Convert API request to SQL params using from_request()
            params = SaveDocumentSqlParams.from_request(request, profile_id)
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
                if request.input_document_id:
                    raise ValueError(f"Document not found: {request.input_document_id}")
                else:
                    raise ValueError("Failed to create document")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                if request.input_document_id:
                    audit_ctx["document"] = {
                        "name": getattr(request, "name", "Document"),
                        "id": str(result.document_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        is_update = request.input_document_id is not None
        api_response = SaveDocumentApiResponse.model_validate(
            {
                "success": True,
                "document_id": str(result.document_id),
                "message": "Document updated successfully"
                if is_update
                else "Document created successfully",
            }
        )

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
            operation="save_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
