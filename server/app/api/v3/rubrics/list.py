"""Rubric list endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (DepartmentMappingItem, StandardGroupMappingItem,
                              StandardMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class RubricsListRequest(BaseModel):
    """Request for rubrics list."""

    profileId: str


class RubricItem(BaseModel):
    """Rubric item for list view."""

    rubric_id: str
    name: str
    description: str
    points: int
    passPoints: int
    passPercentage: int
    department_ids: list[str] | None = None
    active_simulation_count: int
    total_simulation_links: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    standard_groups: dict[str, list[str]]  # group_id -> [standard_ids]


class RubricsListResponse(BaseModel):
    """Response for rubrics list."""

    rubrics: list[RubricItem]
    standard_groups_mapping: dict[str, StandardGroupMappingItem]
    standards_mapping: dict[str, StandardMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]


router = APIRouter()


@router.post("/list", response_model=RubricsListResponse)
async def get_rubrics_list(
    filters: RubricsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricsListResponse:
    """Get rubrics list with hierarchical structure and permissions."""
    tags = ["rubrics"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return RubricsListResponse.model_validate(cached["data"])
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/rubrics/list_rubrics.sql")
        sql_params = (filters.profileId,)
        rows = await conn.fetch(sql_query, filters.profileId)

        rubrics: list[RubricItem] = []
        standard_groups_mapping: dict[str, StandardGroupMappingItem] = {}
        standards_mapping: dict[str, StandardMappingItem] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}

        # Parse mappings from first row (same across all rows, replicate v2 logic)
        if rows:
            first_row = rows[0]

            # Parse standard_groups_mapping from JSONB (replicate v2 logic)
            groups_mapping_data = first_row.get("standard_groups_mapping")
            if isinstance(groups_mapping_data, str):
                groups_mapping_data = json.loads(groups_mapping_data)
            if groups_mapping_data and isinstance(groups_mapping_data, dict):
                for group_id, gdata in groups_mapping_data.items():
                    if isinstance(gdata, dict):
                        standard_groups_mapping[group_id] = StandardGroupMappingItem(
                            name=gdata.get("name", ""),
                            description=gdata.get("description", ""),
                            points=gdata.get("points", 0),
                            passPoints=gdata.get("passPoints", 0),
                        )

            # Parse standards_mapping from JSONB (replicate v2 logic)
            standards_mapping_data = first_row.get("standards_mapping")
            if isinstance(standards_mapping_data, str):
                standards_mapping_data = json.loads(standards_mapping_data)
            if standards_mapping_data and isinstance(standards_mapping_data, dict):
                for standard_id, sdata in standards_mapping_data.items():
                    if isinstance(sdata, dict):
                        standards_mapping[standard_id] = StandardMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            points=sdata.get("points", 0),
                        )

            # Parse department_mapping from JSONB (replicate v2 logic)
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for dept_id, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[dept_id] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Build rubric items with hierarchical structure (replicate v2 logic)
        for row in rows:
            # Parse standard_groups structure for this rubric (replicate v2 logic)
            standard_groups_dict = {}
            standard_groups_data = row.get("standard_groups")
            # Parse JSONB string to dict (asyncpg returns JSONB as string)
            if isinstance(standard_groups_data, str):
                standard_groups_data = json.loads(standard_groups_data)
            if standard_groups_data and isinstance(standard_groups_data, dict):
                for group_id, standards_list in standard_groups_data.items():
                    if isinstance(standards_list, list):
                        standard_groups_dict[group_id] = standards_list
                    else:
                        standard_groups_dict[group_id] = []

            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Compute passPercentage server-side
            points = row["points"]
            pass_points = row["passpoints"]
            pass_percentage = round((pass_points / points) * 100) if points > 0 else 0

            rubrics.append(
                RubricItem(
                    rubric_id=str(row["rubric_id"]),
                    name=row["name"],
                    description=row["description"],
                    department_ids=dept_ids,
                    points=points,
                    passPoints=pass_points,
                    passPercentage=pass_percentage,
                    active_simulation_count=row["active_simulation_count"],
                    total_simulation_links=row["total_simulation_links"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    standard_groups=standard_groups_dict,
                )
            )

        response_data = RubricsListResponse(
            rubrics=rubrics,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
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
            operation="get_rubrics_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

