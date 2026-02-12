"""Auth list endpoint.

Currently uses SQL-computed permissions (can_edit, can_delete, can_duplicate).
Future: modify list SQL to return user_role separately and compute in Python.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.auth.types import (
    ListAuthApiAuth,
    ListAuthApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAuthListApiRequest,
    GetAuthListSqlParams,
    GetAuthListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/auth/get_auth_list_complete.sql"

router = APIRouter()


@router.post(
    "/list",
    response_model=ListAuthApiResponse,
    dependencies=[audit_activity("auth.list", "{{ actor.name }} viewed auth list")],
)
async def get_auth_list(
    request: GetAuthListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListAuthApiResponse:
    """Get auth list with item counts and permissions."""
    tags = ["auth"]

    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListAuthApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=bypass_cache,
                )
                actor_name = resolved_context.actor_name
        else:
            actor_name = None

        params = GetAuthListSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        result = cast(
            GetAuthListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Transform SQL result to handcrafted types
        # Note: permissions are currently computed in SQL
        auths_list: list[ListAuthApiAuth] = []
        for auth in result.auths or []:
            auths_list.append(
                ListAuthApiAuth(
                    auth_id=auth.auth_id,
                    name=auth.name,
                    description=auth.description,
                    is_inactive=not auth.active if auth.active is not None else None,
                    item_count=auth.num_items,
                    can_edit=auth.can_edit,
                    can_duplicate=auth.can_duplicate,
                    can_delete=auth.can_delete,
                )
            )

        api_response = ListAuthApiResponse(
            actor_name=actor_name,
            auths=auths_list,
            total_count=len(auths_list),
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
