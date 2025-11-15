"""Rubric detail endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import DepartmentMappingItem, StandardMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class RubricDetailRequest(BaseModel):
    """Request for rubric detail."""

    rubricId: str
    profileId: str


class StandardGroupDetail(BaseModel):
    """Standard group detail for detail response."""

    points: int
    passPoints: int
    standard_ids: list[str]


class RubricDetailResponse(BaseModel):
    """Response for rubric detail endpoint."""

    name: str
    description: str
    department_ids: list[str] | None
    valid_department_ids: list[str]
    points: int
    passPoints: int
    active: bool
    can_edit: bool
    standard_group_ids: list[str]
    standard_groups_detail: dict[str, StandardGroupDetail]
    standard_groups_mapping: dict[str, dict[str, str]]
    standards_mapping: dict[str, StandardMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]


router = APIRouter()


@router.post("/detail", response_model=RubricDetailResponse)
async def get_rubric_detail(
    request_body: RubricDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricDetailResponse:
    """Get rubric detail information."""
    tags = ["rubrics"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return RubricDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/rubrics/get_rubric_detail_complete.sql")
        sql_params = (
            uuid.UUID(request_body.rubricId),
            uuid.UUID(request_body.profileId),
        )
        row = await conn.fetchrow(
            sql_query,
            uuid.UUID(request_body.rubricId),
            uuid.UUID(request_body.profileId),
        )

        if not row:
            raise HTTPException(status_code=404, detail="Rubric not found")

        # Parse standard groups from JSONB
        standard_groups_detail: dict[str, StandardGroupDetail] = {}
        standard_groups_mapping: dict[str, dict[str, str]] = {}
        standards_mapping: dict[str, StandardMappingItem] = {}
        standard_group_ids: list[str] = []

        if row.get("standard_groups_complete"):
            groups_data = row["standard_groups_complete"]
            if isinstance(groups_data, str):
                groups_data = json.loads(groups_data)
            if isinstance(groups_data, list):
                for group in groups_data:
                    if isinstance(group, dict):
                        group_id = group.get("id", "")
                        standard_group_ids.append(group_id)
                        standard_ids = []
                        if group.get("standards"):
                            for std in group["standards"]:
                                if isinstance(std, dict):
                                    std_id = std.get("id", "")
                                    standard_ids.append(std_id)
                                    standards_mapping[std_id] = StandardMappingItem(
                                        name=std.get("name", ""),
                                        description=std.get("description", ""),
                                        points=std.get("points", 0),
                                    )
                        standard_groups_detail[group_id] = StandardGroupDetail(
                            points=group.get("points", 0),
                            passPoints=group.get("passPoints", 0),
                            standard_ids=standard_ids,
                        )
                        standard_groups_mapping[group_id] = {
                            "name": group.get("name", ""),
                            "description": group.get("description", ""),
                        }

        # Parse department mapping
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if row.get("department_mapping"):
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

        # Compute can_edit permission
        user_role = row.get("user_role", "trainee")
        can_edit = user_role in ("admin", "superadmin")

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        dept_ids = None
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        response_data = RubricDetailResponse(
            name=row.get("name", ""),
            description=row.get("description", ""),
            department_ids=dept_ids,
            valid_department_ids=valid_department_ids,
            points=row.get("points", 0),
            passPoints=row.get("passpoints", 0),
            active=row.get("active", False),
            can_edit=can_edit,
            standard_group_ids=standard_group_ids,
            standard_groups_detail=standard_groups_detail,
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
            operation="get_rubric_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
