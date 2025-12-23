"""Rubric new endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

# Reuse models from detail.py
from app.api.v3.rubrics.detail import (
    AgentMapping,
    AgentMappingItem,
    DepartmentMappingItem,
    RubricDetailResponse,
    StandardGroupDetail,
    StandardMappingItem,
)
from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class RubricNewRequest(BaseModel):
    """Request for default rubric detail."""

    # profileId removed - comes from X-Profile-Id header


router = APIRouter()


@router.post(
    "/new",
    response_model=RubricDetailResponse,
    dependencies=[
        audit_activity("rubric.new", "{{ actor.name }} opened new rubric form")
    ],
)
async def get_rubric_new(
    request_body: RubricNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricDetailResponse:
    """Get default rubric detail information."""
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

        sql_query = load_sql("sql/v3/rubrics/get_rubric_new_complete.sql")
        sql_params = (uuid.UUID(profile_id),)
        row = await conn.fetchrow(sql_query, uuid.UUID(profile_id))

        if not row:
            raise HTTPException(
                status_code=404, detail="No rubrics found for user's departments"
            )

        actor_name = row.get("actor_name")
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Parse standard groups from JSONB (same as detail.py)
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

        # Parse department mapping (same as detail.py)
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

        # Get user role and primary department for default behavior
        user_role = row.get("user_role", "trainee")
        is_superadmin = user_role == "superadmin"
        primary_department_id = row.get("primary_department_id")

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            dept_ids = None
        else:
            dept_ids = [primary_department_id] if primary_department_id else []

        is_default = dept_ids is None or len(dept_ids) == 0
        # Default rubrics (no department_ids) are read-only for non-superadmin
        can_edit = not (is_default and not is_superadmin) and user_role in (
            "admin",
            "superadmin",
        )

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]

        # Get rubric_agent_id from row (may be null for new rubrics)
        rubric_agent_id = row.get("rubric_agent_id")
        rubric_agent_id_str = str(rubric_agent_id) if rubric_agent_id else None

        # Parse agent mapping
        agent_mapping: AgentMapping = {}
        if row.get("agent_mapping"):
            agent_data = row["agent_mapping"]
            if isinstance(agent_data, str):
                agent_data = json.loads(agent_data)
            if isinstance(agent_data, dict):
                for aid, adata in agent_data.items():
                    if isinstance(adata, dict):
                        roles = adata.get("roles", [])
                        if isinstance(roles, str):
                            try:
                                roles = json.loads(roles)
                            except json.JSONDecodeError:
                                roles = []
                        if not isinstance(roles, list):
                            roles = []
                        agent_mapping[aid] = AgentMappingItem(
                            name=adata.get("name", ""),
                            description=adata.get("description", ""),
                            roles=[str(r) for r in roles],
                        )

        valid_agent_ids = [str(aid) for aid in (row.get("valid_agent_ids") or [])]

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
            rubric_agent_id=rubric_agent_id_str,
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
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
            operation="get_rubric_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
