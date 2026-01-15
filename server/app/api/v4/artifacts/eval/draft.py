"""Eval draft endpoint - handles autosave for all eval resources.

TODO: Implement eval draft functionality.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (PatchEvalDraftApiRequest, PatchEvalDraftApiResponse,
                           PatchEvalDraftSqlParams, PatchEvalDraftSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# TODO: Create SQL file for eval draft
SQL_PATH = "app/sql/v4/evals/patch_eval_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchEvalDraftApiResponse,
    dependencies=[
        audit_activity(
            "eval.draft.patched",
            "{{ actor.name }} patched eval draft",
        )
    ],
)
async def patch_eval_draft(
    request: PatchEvalDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchEvalDraftApiResponse:
    """Patch eval draft - accepts resource IDs and creates/updates draft - TODO: Implement functionality."""
    tags = ["evals", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        params = PatchEvalDraftSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        result = cast(
            PatchEvalDraftSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        api_response = PatchEvalDraftApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="patch_eval_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
