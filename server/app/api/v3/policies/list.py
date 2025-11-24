"""Policies list endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMapping
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class PoliciesFilters(BaseModel):
    """Filters for policies list request."""

    profileId: str


class PolicyItem(BaseModel):
    """Individual policy item in the response."""

    policy_id: str
    name: str
    description: str
    file_path: str
    mime_type: str
    active: bool
    created_at: str
    updated_at: str
    can_edit: bool
    can_delete: bool


class PoliciesListResponse(BaseModel):
    """Response for policies list endpoint."""

    policies: list[PolicyItem]
    department_mapping: DepartmentMapping


router = APIRouter()


@router.post("/list", response_model=PoliciesListResponse)
async def get_policies_list(
    filters: PoliciesFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PoliciesListResponse:
    """Get policies list."""
    tags = ["policies"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return PoliciesListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/policies/list_policies.sql")
        sql_params = (filters.profileId,)

        # Execute query
        result = await conn.fetch(sql_query, filters.profileId)

        # Build response - transform database rows
        policies = []
        department_mapping: DepartmentMapping = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, dict):
                department_mapping = department_mapping_data

        # Build policy items
        for row in result:
            policies.append(
                PolicyItem(
                    policy_id=str(row["policy_id"]),
                    name=row["name"],
                    description=row["description"],
                    file_path=row["file_path"],
                    mime_type=row["mime_type"],
                    active=row["active"],
                    created_at=str(row["created_at"]),
                    updated_at=str(row["updated_at"]),
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        response_data = PoliciesListResponse(
            policies=policies,
            department_mapping=department_mapping,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_policies_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

