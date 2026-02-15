"""Evals list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_option_ids (id + count)
2. Python hydrates department names from cached *_internal() functions
3. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.eval.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.eval.types import (
    ListEvalApiEval,
    ListEvalApiResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.types import ListFilterSection
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetEvalsListApiRequest,
    GetEvalsListSqlParams,
    GetEvalsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/evals/get_evals_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListEvalApiResponse,
    dependencies=[
        audit_activity("evals.list", "{{ actor.name }} visited the Evals page")
    ],
)
async def get_eval_list(
    request: GetEvalsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListEvalApiResponse:
    """Get evals list with permissions and status details."""
    tags = ["evals"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListEvalApiResponse.model_validate(cached["data"])

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

        # Fetch user context for audit logging and permissions
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id from header)
        params = GetEvalsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetEvalsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # user_role already fetched from context above

        # Compute permissions for each eval in Python
        evals_with_permissions: list[ListEvalApiEval] = []
        for eval_item in result.evals or []:
            can_edit_val = compute_can_edit(user_role=user_role)
            can_delete_val = compute_can_delete(user_role=user_role)
            can_duplicate_val = compute_can_duplicate(user_role)

            evals_with_permissions.append(
                ListEvalApiEval(
                    eval_id=eval_item.eval_id,
                    name=eval_item.name,
                    description=eval_item.description,
                    department_ids=eval_item.department_ids,
                    is_inactive=eval_item.is_inactive,
                    is_dynamic=eval_item.is_dynamic,
                    use_groups=eval_item.use_groups,
                    num_runs=eval_item.num_runs,
                    num_groups=eval_item.num_groups,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=eval_item.updated_at,
                )
            )

        # Build API response with ListFilterSection pattern (names resolved in SQL)
        api_response = ListEvalApiResponse(
            actor_name=actor_name,
            evals=evals_with_permissions,
            department_filter=ListFilterSection.from_sql_options(
                getattr(result, "department_options", None),
                getattr(request, "filter_department_ids", None),
                getattr(request, "department_search", None),
            ),
            total_count=result.total_count,
            user_role=user_role,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
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
            operation="get_eval_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
