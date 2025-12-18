"""Profile new endpoint - get default profile details for creation."""

import json
from typing import Annotated, Any

import asyncpg
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


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


# Type alias for Dict mapping
DepartmentMapping = dict[str, DepartmentMappingItem]
CohortMapping = dict[str, CohortMappingItem]

router = APIRouter()


class ProfileNewRequest(BaseModel):
    """Request to get default profile details."""

    # profileId removed - comes from X-Profile-Id header


class ProfileNewResponse(BaseModel):
    """Response with default profile details and metadata."""

    # Basic fields (empty defaults for creation)
    first_name: str
    last_name: str
    emails: list[str]
    role: str
    requests_per_day: int | None
    primary_department_id: str | None
    active: bool

    # Permissions
    can_edit: bool

    # Metadata/Options
    valid_department_ids: list[str]
    valid_cohort_ids: list[str]
    role_options: list[str]

    # Mappings
    department_mapping: DepartmentMapping
    cohort_mapping: CohortMapping


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post(
    "/new",
    response_model=ProfileNewResponse,
    dependencies=[
        audit_activity("profile.new", "{{ actor.name }} viewed new profile form")
    ],
)
async def get_profile_new(
    request: ProfileNewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileNewResponse:
    """Get default profile structure for creation mode."""
    tags = ["profile"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ProfileNewResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Load SQL query
        sql_query = load_sql("sql/v3/profile/staff/get_staff_new_complete.sql")
        sql_params = (profile_id,)

        # Execute query
        result = await conn.fetchrow(sql_query, profile_id)

        if not result:
            raise HTTPException(
                status_code=404, detail="Failed to fetch default profile data"
            )

        valid_department_ids = result.get("valid_department_ids", [])
        if not valid_department_ids:
            valid_department_ids = []

        valid_cohort_ids = result.get("valid_cohort_ids", [])
        if not valid_cohort_ids:
            valid_cohort_ids = []

        # Get user role and primary department for default behavior
        user_role = str(result.get("user_role", "")).lower()
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.get("primary_department_id")

        # Parse department_mapping
        department_mapping_data = parse_jsonb(result.get("dept_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse cohort_mapping
        cohort_mapping_data = parse_jsonb(result.get("cohort_mapping"))
        cohort_mapping: CohortMapping = {}
        if isinstance(cohort_mapping_data, dict):
            for cohort_id, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cohort_id] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Role options
        role_options = ["superadmin", "admin", "instructional", "member", "guest"]

        # Default values for new profile
        response_data = ProfileNewResponse(
            # Basic fields (empty defaults for creation)
            first_name="",
            last_name="",
            emails=[""],
            role="instructional",  # Default role
            requests_per_day=None,  # Unlimited by default
            primary_department_id=primary_department_id if not is_superadmin else None,
            active=True,
            # Permissions
            can_edit=True,  # User can always create profile
            # Metadata
            valid_department_ids=valid_department_ids,
            valid_cohort_ids=valid_cohort_ids,
            role_options=role_options,
            # Mappings
            department_mapping=department_mapping,
            cohort_mapping=cohort_mapping,
        )

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            profile_id,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
