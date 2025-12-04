"""Staff new endpoint - get default staff details for creation."""

import json
from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMapping, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class StaffNewRequest(BaseModel):
    """Request to get default staff details."""

    profileId: str


class StaffNewResponse(BaseModel):
    """Response with default staff details and metadata."""

    # Basic fields (empty defaults for creation)
    first_name: str
    last_name: str
    emails: list[str]
    role: str
    requests_per_day: int | None
    primary_department_id: str | None
    active: bool
    default_profile: bool

    # Permissions
    can_edit: bool

    # Metadata/Options
    valid_department_ids: list[str]
    role_options: list[str]

    # Mappings
    department_mapping: DepartmentMapping


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post("/new", response_model=StaffNewResponse)
async def get_staff_new(
    request: StaffNewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffNewResponse:
    """Get default staff structure for creation mode."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return StaffNewResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL query
        sql_query = load_sql("sql/v3/profile/staff/get_staff_new_complete.sql")
        sql_params = (request.profileId,)

        # Execute query
        result = await conn.fetchrow(sql_query, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail="Failed to fetch default staff data"
            )

        valid_department_ids = result.get("valid_department_ids", [])
        if not valid_department_ids:
            valid_department_ids = []

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

        # Role options
        role_options = ["superadmin", "admin", "instructional", "ta", "guest"]

        # Default values for new staff
        response_data = StaffNewResponse(
            # Basic fields (empty defaults for creation)
            first_name="",
            last_name="",
            emails=[""],
            role="instructional",  # Default role
            requests_per_day=None,  # Unlimited by default
            primary_department_id=primary_department_id if not is_superadmin else None,
            active=True,
            default_profile=False,
            # Permissions
            can_edit=True,  # User can always create staff
            # Metadata
            valid_department_ids=valid_department_ids,
            role_options=role_options,
            # Mappings
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_staff_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

