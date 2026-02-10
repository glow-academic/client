"""Fields list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids and total_parameter_links
2. Python computes permissions (can_edit, can_delete, can_duplicate)
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.field.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.field.types import (
    ListFieldApiConditionalParameter,
    ListFieldApiDepartment,
    ListFieldApiField,
    ListFieldApiResponse,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetFieldsListApiRequest,
    GetFieldsListSqlParams,
    GetFieldsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/fields/get_fields_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListFieldApiResponse,
    dependencies=[
        audit_activity("fields.list", "{{ actor.name }} visited the Fields page")
    ],
)
async def get_field_list(
    request: GetFieldsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListFieldApiResponse:
    """Get fields list with permissions and relationships."""
    tags = ["fields"]

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
            return ListFieldApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        params = GetFieldsListSqlParams(profile_id=profile_id)
        sql_params = params.to_tuple()

        result = cast(
            GetFieldsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Get user_role from SQL result for Python permission computation
        user_role = result.user_role

        # Compute permissions for each field in Python
        fields_with_permissions: list[ListFieldApiField] = []
        for field in result.fields or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                field_department_ids=field.department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                field_department_ids=field.department_ids,
                total_parameter_links=field.total_parameter_links or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            fields_with_permissions.append(
                ListFieldApiField(
                    field_id=field.field_id,
                    name=field.name,
                    description=field.description,
                    department_ids=field.department_ids,
                    conditional_parameter_ids=field.conditional_parameter_ids,
                    is_inactive=field.is_inactive,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=field.updated_at,
                )
            )

        # Transform parameters and departments to API types
        conditional_parameters = [
            ListFieldApiConditionalParameter(
                parameter_id=p.parameter_id,
                name=p.name,
                description=p.description,
                count=p.count,
            )
            for p in (result.parameters or [])
        ]

        departments = [
            ListFieldApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description,
                count=d.count,
            )
            for d in (result.departments or [])
        ]

        # Build API response with computed permissions
        api_response = ListFieldApiResponse(
            actor_name=result.actor_name,
            fields=fields_with_permissions,
            conditional_parameters=conditional_parameters,
            departments=departments,
            total_count=result.total_count,
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
            operation="get_field_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
