"""Rubric detail endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class StandardMappingItem(BaseModel):
    """Standard mapping item with points."""

    name: str
    description: str
    points: int


class RubricDetailRequest(BaseModel):
    """Request for rubric detail."""

    rubricId: str
    # profileId removed - comes from X-Profile-Id header


class StandardGroupDetail(BaseModel):
    """Standard group detail for detail response."""

    points: int
    passPoints: int
    position: int
    active: bool
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


@router.post(
    "/detail",
    response_model=RubricDetailResponse,
    dependencies=[
        audit_activity(
            "rubric.viewed", "{{ actor.name }} viewed rubric '{{ rubric.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("sql/v3/rubrics/get_rubric_detail_complete.sql")
        sql_params = (
            uuid.UUID(request_body.rubricId),
            uuid.UUID(profile_id),
        )
        row = await conn.fetchrow(
            sql_query,
            uuid.UUID(request_body.rubricId),
            uuid.UUID(profile_id),
        )

        if not row:
            # Check if rubric exists but user doesn't have department access
            rubric_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM rubrics WHERE id = $1)",
                uuid.UUID(request_body.rubricId),
            )
            if rubric_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this rubric. It may be restricted to other departments.",
                )
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
                            position=group.get("position", 1),
                            active=group.get("active", True),
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

        # Get can_edit from SQL (handles default objects and role checks)
        can_edit = row.get("can_edit", False)

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        dept_ids = None
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        # Set audit context with data from SQL query
        actor_name = row.get("actor_name")
        rubric_name = row.get("name")
        if actor_name:
            audit_set(
                request,
                actor={"name": actor_name, "id": profile_id},
                rubric={"name": rubric_name, "id": request_body.rubricId},
            )

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
