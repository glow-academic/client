"""Scenario draft endpoint - handles autosave for all scenario resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.types import (
    PatchScenarioDraftApiRequest,
    PatchScenarioDraftApiResponse,
    PatchScenarioDraftSqlParams,
    PatchScenarioDraftSqlRow,
)
from app.infra.v4.activity.audit import audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/scenarios/patch_scenario_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchScenarioDraftApiResponse,
)
async def patch_scenario_draft(
    request: PatchScenarioDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchScenarioDraftApiResponse:
    """Patch scenario draft - accepts resource IDs and creates/updates draft."""
    tags = ["scenarios", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            params = PatchScenarioDraftSqlParams.from_request(
                request, profile_id=profile_id, group_id=None
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchScenarioDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch scenario draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        is_update = request.input_draft_id is not None
        api_response = PatchScenarioDraftApiResponse.model_validate(
            {
                "success": True,
                "draft_id": str(result.draft_id),
                "new_version": result.new_version,
                "message": "Draft updated successfully"
                if is_update
                else "Draft created successfully",
            }
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
            operation="patch_scenario_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
