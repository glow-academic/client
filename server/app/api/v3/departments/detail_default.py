"""Department detail-default endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import CohortMappingItem, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class DepartmentDetailDefaultRequest(BaseModel):
    """Request for default department detail."""

    profileId: str


class StaffItem(BaseModel):
    """Staff item from department detail."""

    profile_id: str
    first_name: str
    last_name: str
    alias: str
    name: str
    role: str
    email: str
    initials: str
    active: bool
    last_active: str | None = None
    cohort_ids: list[str] = []
    department_ids: list[str] = []
    requests_per_day: int | None = None
    total_requests: int = 0
    default_profile: bool
    requests_in_last_day: int = 0
    can_edit: bool
    can_delete: bool


class DepartmentDetailResponse(BaseModel):
    """Response for department detail."""

    title: str
    description: str
    active: bool
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    in_use: bool
    staff_count: int
    total_price_spent: float
    staff: list[StaffItem]
    cohort_mapping: dict[str, CohortMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]


router = APIRouter()


@router.post("/detail-default", response_model=DepartmentDetailResponse)
async def get_department_detail_default(
    request_body: DepartmentDetailDefaultRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get default department detail for creation mode."""
    tags = ["departments"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DepartmentDetailResponse.model_validate(cached["data"])
    
    try:
        sql = load_sql("sql/v3/departments/get_department_default_complete.sql")
        result = await conn.fetchrow(sql, request_body.profileId)

        if not result:
            raise HTTPException(status_code=404, detail=f"Profile {request_body.profileId} not found")

        is_superadmin = result["profile_role"] == "superadmin"

        response_data = DepartmentDetailResponse(
            title="",
            description="",
            active=True,
            can_edit=is_superadmin,
            can_duplicate=False,
            can_delete=False,
            in_use=False,
            staff_count=0,
            total_price_spent=0.0,
            staff=[],
            cohort_mapping={},
            department_mapping={},
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
        raise HTTPException(status_code=500, detail=str(e))

