"""Key new endpoint - v3 API following DHH principles."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

# Reuse models from detail.py
from app.api.v3.keys.detail import DepartmentMappingItem, KeyDetailResponse
from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


class KeyNewRequest(BaseModel):
    """Request for default key detail."""

    pass
    # profileId removed - comes from X-Profile-Id header


router = APIRouter()


@router.post(
    "/new",
    response_model=KeyDetailResponse,
    dependencies=[audit_activity("key.new", "{{ actor.name }} viewed new key form")],
)
async def get_key_new(
    request_body: KeyNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> KeyDetailResponse:
    """Get default key detail information for new key creation."""
    tags = ["keys"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return KeyDetailResponse.model_validate(cached["data"])

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

        sql_query = load_sql("app/sql/v3/keys/get_key_new_complete.sql")
        sql_params = (uuid.UUID(profile_id),)
        row = await conn.fetchrow(sql_query, uuid.UUID(profile_id))

        if not row:
            raise HTTPException(
                status_code=404, detail="Failed to get default key data"
            )

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

        # Parse model mapping (empty for default)
        model_mapping: dict[str, dict[str, Any]] = {}
        if row.get("model_mapping"):
            model_data = row["model_mapping"]
            if isinstance(model_data, str):
                model_data = json.loads(model_data)
            if isinstance(model_data, dict):
                model_mapping = model_data

        # Get user role and primary department for default behavior
        user_role = row.get("user_role", "guest")
        is_superadmin = user_role == "superadmin"
        primary_department_id = row.get(
            "department_id"
        )  # From primary_department_id CTE

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            dept_ids: list[str] | None = None
        else:
            dept_ids = [primary_department_id] if primary_department_id else []

        is_default = dept_ids is None or len(dept_ids) == 0
        # Default keys (no department_ids) are read-only for non-superadmin
        can_edit = not (is_default and not is_superadmin) and user_role in (
            "admin",
            "superadmin",
        )

        # Set audit context with data from SQL query
        actor_name = row.get("actor_name")
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        model_ids = []
        if row.get("model_ids"):
            model_ids = [str(mid) for mid in row["model_ids"]]

        response_data = KeyDetailResponse(
            key_id=row.get("key_id", ""),
            name=row.get("name", ""),
            key_masked=row.get("key_masked", "****"),
            type=row.get("type", "api"),
            description=row.get("description", ""),
            active=row.get("active", True),
            created_at=row.get("created_at").isoformat()
            if row.get("created_at")
            else "",
            updated_at=row.get("updated_at").isoformat()
            if row.get("updated_at")
            else "",
            department_ids=dept_ids or [],
            model_ids=model_ids,
            valid_department_ids=valid_department_ids,
            can_edit=can_edit,
            department_mapping=department_mapping,
            model_mapping=model_mapping,
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
            operation="get_key_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
