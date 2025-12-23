"""Department list endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


class ProfileMappingItem(BaseModel):
    """Profile mapping item."""

    name: str
    description: str


# Type aliases for Dict mappings
CohortMapping = dict[str, CohortMappingItem]
ProfileMapping = dict[str, ProfileMappingItem]


class DepartmentsListRequest(BaseModel):
    """Request for departments list."""

    # profileId removed - comes from X-Profile-Id header


class DepartmentItem(BaseModel):
    """Department item for list view."""

    department_id: str
    title: str
    description: str
    active: bool
    updated_at: str
    total_price_spent: float
    staff_count: int
    cohort_ids: list[str]
    profile_ids: list[str]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class DepartmentsListResponse(BaseModel):
    """Response for departments list."""

    departments: list[DepartmentItem]
    cohort_mapping: CohortMapping
    profile_mapping: ProfileMapping


router = APIRouter()


@router.post(
    "/list",
    response_model=DepartmentsListResponse,
    dependencies=[
        audit_activity(
            "departments.list", "{{ actor.name }} visited the Departments page"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/departments/get_departments_list.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor_name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        departments = []
        cohort_mapping: CohortMapping = {}
        profile_mapping: ProfileMapping = {}

        # Parse mappings from first row (same across all rows)
        if rows:
            first_row = rows[0]

            # Parse cohort_mapping from JSONB
            cohort_mapping_data = first_row.get("cohort_mapping")
            if isinstance(cohort_mapping_data, str):
                cohort_mapping_data = json.loads(cohort_mapping_data)
            if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
                for cid, cdata in cohort_mapping_data.items():
                    if isinstance(cdata, dict):
                        cohort_mapping[cid] = CohortMappingItem(
                            name=cdata.get("name", ""),
                            description=cdata.get("description", ""),
                        )

            # Parse profile_mapping from JSONB
            profile_mapping_data = first_row.get("profile_mapping")
            if isinstance(profile_mapping_data, str):
                profile_mapping_data = json.loads(profile_mapping_data)
            if profile_mapping_data and isinstance(profile_mapping_data, dict):
                for pid, pdata in profile_mapping_data.items():
                    if isinstance(pdata, dict):
                        profile_mapping[pid] = ProfileMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                        )

        # Get current user's role for role-based filtering
        user_role_row = await conn.fetchrow(
            "SELECT role FROM profiles WHERE id = $1",
            profile_id,
        )
        current_user_role = user_role_row["role"] if user_role_row else "guest"

        # Get roles for all profiles in profile_mapping for role-based filtering
        profile_ids_for_role_check = list(profile_mapping.keys())
        profile_roles_map = {}
        if profile_ids_for_role_check:
            profile_role_rows = await conn.fetch(
                """
                SELECT id, role
                FROM profiles
                WHERE id = ANY($1::uuid[])
                """,
                profile_ids_for_role_check,
            )
            profile_roles_map = {
                str(row["id"]): row["role"] for row in profile_role_rows
            }

        # Define role hierarchy (who can see which roles)
        def can_see_role(user_role: str, target_role: str) -> bool:
            """Check if user_role can see target_role based on role hierarchy."""
            if user_role == "superadmin":
                return True
            elif user_role == "admin":
                return target_role in ("admin", "instructional", "member", "guest")
            elif user_role == "instructional":
                return target_role in ("instructional", "member", "guest")
            elif user_role == "member":
                return target_role in ("member", "guest")
            elif user_role == "guest":
                return target_role == "guest"
            return False

        # Filter profile_mapping to only include profiles user can see based on role hierarchy
        filtered_profile_mapping = {
            pid: p
            for (pid, p) in profile_mapping.items()
            if can_see_role(current_user_role, profile_roles_map.get(pid, "guest"))
        }

        for row in rows:
            cohort_ids = []
            if row.get("cohort_ids"):
                cohort_ids = [str(cid) for cid in row["cohort_ids"]]

            profile_ids = []
            if row.get("profile_ids"):
                # Filter profile_ids to only include profiles user can see
                all_profile_ids = [str(pid) for pid in row["profile_ids"]]
                profile_ids = [
                    pid for pid in all_profile_ids if pid in filtered_profile_mapping
                ]

            # Recalculate staff_count based on filtered profiles
            staff_count = len(profile_ids)

            # Only include departments with staff_count > 0 (after role filtering)
            if staff_count > 0:
                departments.append(
                    DepartmentItem(
                        department_id=row["department_id"],
                        title=row["title"],
                        description=row["description"],
                        active=row["active"],
                        updated_at=row["updated_at"].isoformat(),
                        total_price_spent=float(row["total_price_spent"]),
                        staff_count=staff_count,
                        cohort_ids=cohort_ids,
                        profile_ids=profile_ids,
                        can_edit=row["can_edit"],
                        can_delete=row["can_delete"],
                        can_duplicate=row["can_duplicate"],
                    )
                )

        response_data = DepartmentsListResponse(
            departments=departments,
            cohort_mapping=cohort_mapping,
            profile_mapping=filtered_profile_mapping,
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
            operation="get_departments_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
