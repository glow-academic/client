"""Persona delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import compute_can_delete
from app.api.v4.artifacts.persona.types import (
    DeletePersonaApiRequest,
    DeletePersonaApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckPersonaDeleteAccessSqlParams,
    CheckPersonaDeleteAccessSqlRow,
    DeletePersonaSqlParams,
    DeletePersonaSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/personas/check_persona_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/v4/queries/personas/delete_persona_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeletePersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.deleted", "{{ actor.name }} deleted persona '{{ persona.name }}'"
        )
    ],
)
async def delete_persona(
    request: DeletePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaApiResponse:
    """Delete a persona."""
    tags = ["personas"]  # From router tags

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
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and persona info using typed SQL
        access_params = CheckPersonaDeleteAccessSqlParams(
            profile_id=profile_id,
            persona_id=request.persona_id,
        )
        access_result = cast(
            CheckPersonaDeleteAccessSqlRow,
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
            persona_department_ids=access_result.persona_department_ids,
            total_scenario_links=access_result.total_scenario_links or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this persona.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DeletePersonaSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DeletePersonaSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check persona usage")

            usage_count = result.usage_count or 0
            if usage_count > 0:
                raise ValueError("Cannot delete persona that is in use by scenarios")

            if not result.deleted:
                raise ValueError(f"Persona not found: {request.persona_id}")

            persona_name = result.name or "Unknown"

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    persona={"name": persona_name, "id": str(request.persona_id)},
                )

        # Convert SQL result to API response
        api_response = DeletePersonaApiResponse.model_validate(
            {
                "success": True,
                "message": f"Persona '{persona_name}' deleted successfully",
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
            operation="delete_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
