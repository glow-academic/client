"""Rubric list endpoint - v3 API."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import DepartmentMappingItem, StandardGroupMappingItem, StandardMappingItem
from app.utils.sql_helper import load_sql


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
    
    try:
        sql = load_sql("sql/v3/rubrics/list_rubrics.sql")
        rows = await conn.fetch(sql, filters.profileId)

        rubrics: list[RubricItem] = []
        standard_groups_mapping: dict[str, StandardGroupMappingItem] = {}
        standards_mapping: dict[str, StandardMappingItem] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}

        for row in rows:
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Parse standard_groups structure
            groups_data = row.get("standard_groups")
            if isinstance(groups_data, str):
                groups_data = json.loads(groups_data)
            if not isinstance(groups_data, dict):
                groups_data = {}

            rubrics.append(
                RubricItem(
                    rubric_id=row["rubric_id"],
                    name=row["name"],
                    description=row["description"],
                    points=row["points"],
                    passPoints=row["passPoints"],
                    department_ids=dept_ids,
                    active_simulation_count=row["active_simulation_count"],
                    total_simulation_links=row["total_simulation_links"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    standard_groups=groups_data,
                )
            )

            # Parse mappings from first row
            if not standard_groups_mapping and row["standard_groups_mapping"]:
                sg_data = row["standard_groups_mapping"]
                if isinstance(sg_data, str):
                    sg_data = json.loads(sg_data)
                if isinstance(sg_data, dict):
                    for sgid, sgdata in sg_data.items():
                        if isinstance(sgdata, dict):
                            standard_groups_mapping[sgid] = StandardGroupMappingItem(
                                name=sgdata.get("name", ""),
                                description=sgdata.get("description", ""),
                                points=sgdata.get("points", 0),
                                passPoints=sgdata.get("passPoints", 0),
                            )

            if not standards_mapping and row["standards_mapping"]:
                s_data = row["standards_mapping"]
                if isinstance(s_data, str):
                    s_data = json.loads(s_data)
                if isinstance(s_data, dict):
                    for sid, sdata in s_data.items():
                        if isinstance(sdata, dict):
                            standards_mapping[sid] = StandardMappingItem(
                                name=sdata.get("name", ""),
                                description=sdata.get("description", ""),
                                points=sdata.get("points", 0),
                            )

            if not department_mapping and row["department_mapping"]:
                dept_data = row["department_mapping"]
                if isinstance(dept_data, str):
                    dept_data = json.loads(dept_data)
                if isinstance(dept_data, dict):
                    for did, ddata in dept_data.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata.get("name", ""),
                                description=ddata.get("description", ""),
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

