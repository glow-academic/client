"""Profile emulation stop endpoint - revoke emulation grants."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    StopEmulationApiRequest,
    StopEmulationApiResponse,
    StopEmulationSqlParams,
    StopEmulationSqlRow,
    load_sql_query,
)

SQL_PATH = "app/sql/v4/auth/stop_emulation_complete.sql"

router = APIRouter()


@router.post(
    "/emulate/stop",
    response_model=StopEmulationApiResponse,
    dependencies=[
        audit_activity("profile.emulation.stop", "{{ actor.name }} stopped emulation")
    ],
)
async def stop_emulation(
    request: StopEmulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StopEmulationApiResponse:
    """Revoke emulation grants for the current profile."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        requester_profile_id = getattr(http_request.state, "profile_id", None)
        if requester_profile_id is None:
            raise HTTPException(status_code=401, detail="Missing profile")

        params = StopEmulationSqlParams(
            profile_id=requester_profile_id,
        )
        sql_params = params.to_tuple()

        result = cast(
            StopEmulationSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if result:
            audit_set(
                http_request,
                actor={"name": "", "id": requester_profile_id},
            )

        api_response = StopEmulationApiResponse.model_validate(
            result.model_dump()
        )

        tags = ["profile"]
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="stop_emulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
