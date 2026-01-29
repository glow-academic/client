"""Simulation draft endpoint - handles autosave for all simulation resources.

Uses Python-computed permissions for access control.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import compute_can_draft
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    PatchSimulationDraftApiRequest,
    PatchSimulationDraftApiResponse,
    PatchSimulationDraftSqlParams,
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

        # Get user role from profile context for permission check
        # For drafts, we use a simpler permission check - any non-learner can use drafts
        # The actual save operation will do the full permission check
        user_profile_query = """
            SELECT role::text as user_role
            FROM view_user_profile_context
            WHERE profile_id = $1
            LIMIT 1
        """
        user_profile_row = await conn.fetchrow(user_profile_query, profile_id)
        user_role = user_profile_row["user_role"] if user_profile_row else None

        # Check draft permission using Python
        if not compute_can_draft(user_role):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or modify drafts.",
            )

        async with conn.transaction():
            params = PatchSimulationDraftSqlParams(
                **request.model_dump(), profile_id=profile_id
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
