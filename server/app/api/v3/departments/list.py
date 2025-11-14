"""Department list endpoint - v3 API."""

import json
import os
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import CohortMappingItem, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class DepartmentsListRequest(BaseModel):
    """Request for departments list."""

    profileId: str


class DepartmentItem(BaseModel):
    """Department item for list view."""

    department_id: str
    title: str
    description: str
    active: bool
    updated_at: str
    total_price_spent: float
    staff_count: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class DepartmentsListResponse(BaseModel):
    """Response for departments list."""

    departments: list[DepartmentItem]


router = APIRouter()


@router.post("/list", response_model=DepartmentsListResponse)
async def get_departments_list(
    filters: DepartmentsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentsListResponse:
    """Get list of departments with computed fields."""
    tags = ["departments"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DepartmentsListResponse.model_validate(cached["data"])
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/departments/get_departments_list.sql")
        sql_params = (filters.profileId,)
        rows = await conn.fetch(sql_query, filters.profileId)

        departments = []
        for row in rows:
            departments.append(
                DepartmentItem(
                    department_id=row["department_id"],
                    title=row["title"],
                    description=row["description"],
                    active=row["active"],
                    updated_at=row["updated_at"].isoformat(),
                    total_price_spent=float(row["total_price_spent"]),
                    staff_count=int(row["staff_count"]),
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

        response_data = DepartmentsListResponse(departments=departments)
        
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
            operation="get_departments_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

