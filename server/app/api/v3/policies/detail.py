"""Policy detail endpoint - v3 API following DHH principles."""

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
class PolicyDetailRequest(BaseModel):
    """Request to get policy detail."""

    policyId: str
    profileId: str


class PolicyDetailResponse(BaseModel):
    """Response for policy detail."""

    name: str
    description: str
    upload_id: str | None = None
    active: bool
    created_at: str
    updated_at: str
    department_ids: list[str] | None = None
    valid_department_ids: list[str] = []
    can_edit: bool
    can_delete: bool
    department_mapping: DepartmentMapping


router = APIRouter()


@router.post("/detail", response_model=PolicyDetailResponse)
async def get_policy_detail(
    request_data: PolicyDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PolicyDetailResponse:
    """Get detailed policy information."""
    tags = ["policies"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return PolicyDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/policies/get_policy_detail_complete.sql")
        sql_params = (request_data.policyId, request_data.profileId)

        # Execute query
        policy = await conn.fetchrow(
            sql_query, request_data.policyId, request_data.profileId
        )
        if not policy:
            raise HTTPException(
                status_code=404, detail=f"Policy not found: {request_data.policyId}"
            )

        # Parse department_mapping from JSONB
        department_mapping_data = policy.get("department_mapping")
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            department_mapping = department_mapping_data

        dept_ids = None
        if policy.get("department_ids"):
            dept_ids = [str(d) for d in policy["department_ids"]]

        valid_dept_ids = policy.get("valid_department_ids") or []
        if not isinstance(valid_dept_ids, list):
            valid_dept_ids = []

        response_data = PolicyDetailResponse(
            name=policy["name"],
            description=policy["description"],
            upload_id=policy.get("upload_id"),
            active=policy["active"],
            created_at=policy["created_at"],
            updated_at=policy["updated_at"],
            department_ids=dept_ids,
            valid_department_ids=[str(did) for did in valid_dept_ids],
            can_edit=policy["can_edit"],
            can_delete=policy["can_delete"],
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
            operation="get_policy_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

