"""Document delete endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.document.permissions import compute_can_delete
from app.api.v4.artifacts.document.types import (
    DeleteDocumentApiRequest,
    DeleteDocumentApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckDocumentDeleteAccessSqlParams,
    CheckDocumentDeleteAccessSqlRow,
    DeleteDocumentSqlParams,
    DeleteDocumentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/documents/check_document_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/v4/queries/documents/delete_document_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteDocumentApiResponse,
    dependencies=[
        audit_activity(
            "document.deleted",
            "{{ actor.name }} deleted document '{{ document.name }}'",
        )
    ],
)
async def delete_document(
    request: DeleteDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteDocumentApiResponse:
    """Delete a document."""
    tags = ["documents"]  # From router tags

    sql_query = load_sql_query(DELETE_SQL_PATH)
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
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and document info using typed SQL
        access_params = CheckDocumentDeleteAccessSqlParams(
            profile_id=profile_id,
            document_id=request.document_id,
        )
        access_result = cast(
            CheckDocumentDeleteAccessSqlRow,
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

        can_delete = compute_can_delete(
            user_role=user_role,
            document_department_ids=access_result.document_department_ids,
            active_scenario_count=access_result.active_scenario_count or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this document.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DeleteDocumentSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DeleteDocumentSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check document usage")

            usage_count = result.usage_count or 0
            if usage_count > 0:
                raise ValueError("Cannot delete document that is in use by scenarios")

            if not result.deleted:
                raise ValueError(f"Document not found: {request.document_id}")

            document_name = result.document_name or "Unknown"

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    document={
                        "name": document_name,
                        "id": str(request.document_id),
                    },
                )

        # Convert SQL result to API response
        api_response = DeleteDocumentApiResponse.model_validate(
            {
                "success": True,
                "message": f"Document '{document_name}' deleted successfully",
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
            operation="delete_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
