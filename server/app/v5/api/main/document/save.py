"""Document save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (document_id = NULL) and update (document_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.document.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.v5.api.main.document.types import (
    DocumentMultiResourceAction,
    DocumentResourceAction,
    SaveDocumentApiRequest,
    SaveDocumentApiResponse,
    SaveDocumentSqlParams,
    SaveDocumentSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    CheckDocumentSaveAccessSqlParams,
    CheckDocumentSaveAccessSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/v5/sql/queries/documents/check_document_save_access_complete.sql"
)
SQL_PATH = "app/v5/sql/queries/documents/save_document_complete.sql"

router = APIRouter()


async def save_document_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
    document_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a document from resource actions dict (used by generation complete handler).

    Builds SaveDocumentSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the document_id on success, None on failure.
    """
    try:

        def _single(key: str) -> DocumentResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return DocumentResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return DocumentResourceAction()

        def _multi(key: str) -> DocumentMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return DocumentMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return DocumentMultiResourceAction()

        params = SaveDocumentSqlParams(
            profile_id=profile_id,
            input_document_id=document_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            flags=_single("flags"),
            departments=_multi("departments"),
            fields=_multi("fields"),
            uploads=_multi("uploads"),
            images=_multi("images"),
            texts=_multi("texts"),
        )

        async with conn.transaction():
            result = cast(
                SaveDocumentSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.document_id:
                return None

        await invalidate_tags(["documents"])
        return result.document_id

    except Exception as e:
        logger.exception(f"save_document_internal failed: {e}")
        return None


@router.post("/save", response_model=SaveDocumentApiResponse)
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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
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
            can_save_result = compute_can_edit(
                user_role=user_role,
                document_department_ids=access_result.document_department_ids,
                active_scenario_count=access_result.active_scenario_count or 0,
                user_department_ids=user_department_ids,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this document.",
            )

        # Create group_id in Python (server-resolved like persona)
        group_id = None
        if pool:
            async with pool.acquire() as group_conn:
                group_id = await group_conn.fetchval(
                    "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
                )

        async with conn.transaction():
            # Convert API request to SQL params using from_request()
            params = SaveDocumentSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
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
                if request.input_document_id:
                    raise ValueError(f"Document not found: {request.input_document_id}")
                else:
                    raise ValueError("Failed to create document")

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
