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
from utils.sql_helper import execute_sql_typed

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
            # Convert API request to SQL params (add p_profile_id from header)
            # API request may include p_profile_id, but we override it with header value
            request_dict = request.model_dump()
            request_dict["p_profile_id"] = profile_id
            params = PatchPersonaDraftSqlParams(**request_dict)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - calls api_patch_persona_draft_v4_wrapper
            result = cast(
                PatchPersonaDraftSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to patch persona draft")

            # Set audit context
            if profile_id:
                audit_set(
                    http_request,
                    actor={"id": profile_id},
                    draft={"id": str(result.draft_id)},
                )

        # Convert SQL result to API response
        api_response = PatchPersonaDraftApiResponse.model_validate(
            {
                "draftId": str(result.draft_id),
                "newVersion": result.new_version,
                "draftExists": result.draft_exists,
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
            operation="patch_persona_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

