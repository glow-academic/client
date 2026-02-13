"""Persona duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import compute_can_duplicate
from app.api.v4.artifacts.persona.types import (
    DuplicatePersonaApiRequest,
    DuplicatePersonaApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckPersonaDuplicateAccessSqlParams,
    CheckPersonaDuplicateAccessSqlRow,
    DuplicatePersonaSqlParams,
    DuplicatePersonaSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/personas/check_persona_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/v4/queries/personas/duplicate_persona_complete.sql"


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicatePersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.duplicated",
            "{{ actor.name }} duplicated persona '{{ persona.name }}'",
        )
    ],
)
async def duplicate_persona(
    request: DuplicatePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicatePersonaApiResponse:
    """Duplicate a persona."""
    tags = ["personas"]  # From router tags

    sql_query = load_sql_query(DUPLICATE_SQL_PATH)
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

        # Permission check: get user role using typed SQL
        access_params = CheckPersonaDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckPersonaDuplicateAccessSqlRow,
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

        can_duplicate = compute_can_duplicate(user_role=user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate this persona.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicatePersonaSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DuplicatePersonaSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.new_persona_id:
                raise ValueError(f"Persona not found: {request.persona_id}")

            original_name = result.original_name or "Unknown"

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    persona={"name": original_name, "id": str(request.persona_id)},
                )

            # Convert SQL result to API response
            api_response = DuplicatePersonaApiResponse.model_validate(
                {
                    "success": True,
                    "persona_id": str(result.new_persona_id),
                    "message": f"Persona '{original_name}' duplicated successfully",
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
            operation="duplicate_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
