"""Cohort draft endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    PatchCohortDraftApiResponse,
    PatchCohortDraftSqlParams,
    PatchCohortDraftSqlRow,
    load_sql_query,
)


# Custom API request model - accepts dict for patch (client sends dict)
# SQL function accepts text, so we encode dict to JSON string when creating SQL params
class PatchCohortDraftApiRequest(BaseModel):
    patch: dict[str, Any]
    expected_version: int
    input_draft_id: UUID | None = None


# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/cohorts/patch_cohort_draft_complete.sql"


router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchCohortDraftApiResponse,
    dependencies=[
        audit_activity(
            "cohort.draft.patched",
            "{{ actor.name }} saved cohort draft",
        )
    ],
)
async def patch_cohort_draft(
    request: PatchCohortDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchCohortDraftApiResponse:
    """Patch cohort draft (creates if not exists)."""
    tags = ["cohorts", "drafts"]  # From router tags

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

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Encode patch dict as JSON string since SQL function accepts text (not jsonb)
            # This allows asyncpg to pass JSON strings directly without manual encoding
            import json

            patch_json = json.dumps(request.patch) if request.patch else "{}"
            params = PatchCohortDraftSqlParams(
                profile_id=profile_id,
                patch=patch_json,  # SQL function accepts text, so pass JSON string
                expected_version=request.expected_version,
                input_draft_id=request.input_draft_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                PatchCohortDraftSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or result.draft_id is None:
                raise ValueError("Failed to patch cohort draft")

            # Set audit context
            if profile_id:
                audit_set(
                    http_request,
                    actor={"id": profile_id},
                    draft={"id": str(result.draft_id)},
                )

        # Convert SQL result to API response
        api_response = PatchCohortDraftApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        # When creating a new draft, also invalidate profile context cache
        # so the client can refresh and get the new draft_id in the profile context
        if not result.draft_exists:
            tags.append("profile")

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
            operation="patch_cohort_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
