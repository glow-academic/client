"""Simulation draft endpoint - handles autosave for all simulation resources.

Uses Python-computed permissions for access control.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import compute_can_draft
from app.api.v4.artifacts.simulation.types import (
    PatchSimulationDraftApiRequest,
    PatchSimulationDraftApiResponse,
    PatchSimulationDraftSqlParams,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    PatchSimulationDraftSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/simulations/patch_simulation_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchSimulationDraftApiResponse,
    dependencies=[
        audit_activity(
            "simulation.draft.patched",
            "{{ actor.name }} patched simulation draft",
        )
    ],
)
async def patch_simulation_draft(
    request: PatchSimulationDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchSimulationDraftApiResponse:
    """Patch simulation draft - accepts resource IDs and creates/updates draft.

    Uses Python permission checks before executing draft operation.
    """
    tags = ["simulations", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for permissions and audit logging (lazy import to avoid circular deps)
        from app.api.v4.auth.profile import get_auth_profile_internal

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                user_role = profile_ctx.access.role
        else:
            user_role = None

        # Check draft permission using Python (role already fetched from profile context)
        if not compute_can_draft(user_role):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or modify drafts.",
            )

        async with conn.transaction():
            params = PatchSimulationDraftSqlParams.from_request(
                request, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchSimulationDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch simulation draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        api_response = PatchSimulationDraftApiResponse.model_validate(
            result.model_dump()
        )

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
            operation="patch_simulation_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
