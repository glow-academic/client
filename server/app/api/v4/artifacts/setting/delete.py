"""Setting delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteSettingApiRequest,
    DeleteSettingApiResponse,
    DeleteSettingSqlParams,
    DeleteSettingSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/settings/delete_setting_complete.sql"

router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteSettingApiResponse,
    dependencies=[
        audit_activity(
            "setting.deleted",
            "{{ actor.name }} deleted setting '{{ setting.name }}'",
        )
    ],
)
async def delete_setting(
    request: DeleteSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSettingApiResponse:
    """Delete a setting."""
    tags = ["settings"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        params = DeleteSettingSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        result = cast(
            DeleteSettingSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.setting_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Setting not found: {request.setting_id}",
            )
        if not result.deleted:
            raise HTTPException(status_code=500, detail="Failed to delete setting")

        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                setting={"name": result.name, "id": str(result.setting_id)},
            )

        api_response = DeleteSettingApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_setting",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
