"""Persona delete endpoint - v4 API following DHH principles."""

import uuid
from typing import Annotated, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.persona.permissions import compute_can_delete
from app.routes.v5.api.main.persona.types import (
    DeletePersonaApiRequest,
    DeletePersonaApiResponse,
    DeletePersonaResult,
)
from app.sql.types import (
    CheckPersonaDeleteAccessSqlParams,
    CheckPersonaDeleteAccessSqlRow,
    DeletePersonaSqlParams,
    DeletePersonaSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/personas/check_persona_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/personas/delete_persona_complete.sql"

router = APIRouter()


async def delete_persona_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    persona_id: uuid.UUID,
    soft: bool = False,
) -> DeletePersonaSqlRow:
    """Composable persona delete — no transaction or cache management.

    The caller owns the transaction boundary and cache invalidation.

    Args:
        conn: Database connection (caller manages transaction).
        profile_id: Acting user's profile ID.
        persona_id: Persona to delete.
        soft: If True, sets active=false instead of hard deleting.

    Returns the DeletePersonaSqlRow result.
    Raises ValueError if persona is in use or not found/deleted.
    """
    params = DeletePersonaSqlParams(
        persona_id=persona_id, profile_id=profile_id, soft=soft
    )

    result = cast(
        DeletePersonaSqlRow,
        await execute_sql_typed(conn, DELETE_SQL_PATH, params=params),
    )

    if not result:
        raise ValueError(f"Failed to check persona usage: {persona_id}")

    usage_count = result.usage_count or 0
    if usage_count > 0:
        raise ValueError("Cannot delete persona that is in use by scenarios")

    if not result.deleted:
        raise ValueError(f"Persona not found: {persona_id}")

    return result


@router.post("/delete", response_model=DeletePersonaApiResponse)
async def delete_persona(
    request: DeletePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaApiResponse:
    """Bulk delete personas — all-or-nothing single transaction."""
    tags = ["personas"]

    sql_query = load_sql_query(DELETE_SQL_PATH)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context once for the whole batch
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

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, persona_id in enumerate(request.persona_ids):
            access_params = CheckPersonaDeleteAccessSqlParams(
                profile_id=profile_id,
                persona_id=persona_id,
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
                    detail=f"Item {idx}: Unable to verify user permissions.",
                )

            can_delete = compute_can_delete(
                user_role=user_role,
                persona_department_ids=access_result.persona_department_ids,
                active_scenario_count=access_result.active_scenario_count or 0,
            )

            if not can_delete:
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to delete this persona.",
                )

        # Phase 2: Single transaction — execute delete SQL for each item
        results: list[DeletePersonaResult] = []

        async with conn.transaction():
            for idx, persona_id in enumerate(request.persona_ids):
                try:
                    result = await delete_persona_internal(conn, profile_id, persona_id)
                except ValueError as e:
                    raise ValueError(f"Item {idx}: {e}") from e

                persona_name = result.name or "Unknown"
                results.append(
                    DeletePersonaResult(
                        success=True,
                        persona_id=persona_id,
                        message=f"Persona '{persona_name}' deleted successfully",
                    )
                )

        # Audit context
        # Invalidate cache after mutation
        await invalidate_tags(tags, redis=get_redis_client())
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return DeletePersonaApiResponse(results=results)
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
            sql_params=None,
            request=http_request,
        )
