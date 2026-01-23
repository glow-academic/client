"""Settings draft endpoint - handles autosave for all settings resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    PatchSettingDraftApiRequest,
    PatchSettingDraftApiResponse,
    PatchSettingDraftSqlParams,
    PatchSettingDraftSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/settings/patch_setting_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchSettingDraftApiResponse,
    dependencies=[
        audit_activity(
            "setting.draft.patched",
            "{{ actor.name }} patched setting draft",
        )
    ],
)
async def patch_setting_draft(
    request: PatchSettingDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchSettingDraftApiResponse:
    """Patch setting draft - accepts resource IDs and creates/updates draft."""
    tags = ["settings", "drafts"]

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
            params = PatchSettingDraftSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchSettingDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch setting draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        api_response = PatchSettingDraftApiResponse.model_validate(result.model_dump())

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
            operation="patch_setting_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
