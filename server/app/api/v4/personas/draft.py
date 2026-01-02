"""Persona draft endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (PatchPersonaDraftApiRequest,
                           PatchPersonaDraftApiResponse,
                           PatchPersonaDraftSqlParams, PatchPersonaDraftSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/personas/patch_persona_draft_complete.sql"


router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchPersonaDraftApiResponse,
    dependencies=[
        audit_activity(
            "persona.draft.patched",
            "{{ actor.name }} saved persona draft",
        )
    ],
)
async def patch_persona_draft(
    request: PatchPersonaDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchPersonaDraftApiResponse:
    """Patch persona draft (creates if not exists)."""
    tags = ["personas", "drafts"]  # From router tags

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
            # Map draft_id from API to input_draft_id for SQL (to avoid conflict with return column)
            params = PatchPersonaDraftSqlParams(
                **request.model_dump(), profile_id=profile_id
            )

            # Manually construct tuple with JSON-encoded patch for asyncpg
            # asyncpg accepts dict for jsonb, but we need to ensure proper encoding
            import json

            sql_params_tuple = (
                params.profile_id,
                json.dumps(params.patch) if params.patch else "{}",  # Encode dict as JSON string for jsonb
                params.expected_version,
                params.input_draft_id,
            )
            sql_params = sql_params_tuple  # For error tracking

            # Execute SQL manually with encoded params (bypass execute_sql_typed's to_tuple())
            # Note: We bypass execute_sql_typed because we need to encode patch as JSON string for jsonb
            from app.sql.types import get_sql_types

            function_call_sql = 'SELECT * FROM "public"."api_patch_persona_draft_v4"($1, $2, $3, $4)'
            row = await conn.fetchrow(function_call_sql, *sql_params_tuple)

            if not row:
                raise ValueError("Failed to patch persona draft")

            # Convert row to dict and parse result
            InputType, OutputType = get_sql_types(SQL_PATH)
            row_dict = dict(row)
            result = cast(PatchPersonaDraftSqlRow, OutputType.model_validate(row_dict))

            # Set audit context
            if profile_id:
                audit_set(
                    http_request,
                    actor={"id": profile_id},
                    draft={"id": str(result.draft_id)},
                )

        # Convert SQL result to API response
        # API response model uses snake_case (draft_id, new_version, draft_exists)
        api_response = PatchPersonaDraftApiResponse.model_validate(
            {
                "draft_id": result.draft_id,
                "new_version": result.new_version,
                "draft_exists": result.draft_exists,
            }
        )

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
            operation="patch_persona_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

