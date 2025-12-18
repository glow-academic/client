"""Department new endpoint - v3 API."""

import json
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


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str


class DepartmentNewRequest(BaseModel):
    """Request for default department detail."""

    # profileId removed - comes from X-Profile-Id header


class SettingsMappingItem(BaseModel):
    """Settings mapping item."""

    settings_id: str
    created_at: str
    active: bool
    department_ids: list[str] | None = None


class DepartmentDetailResponse(BaseModel):
    """Response for department detail."""

    title: str
    description: str
    active: bool
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    in_use: bool
    staff_count: int
    total_price_spent: float
    settings_id: str | None
    settings_mapping: dict[str, SettingsMappingItem]
    cohort_mapping: dict[str, CohortMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]


router = APIRouter()


@router.post(
    "/new",
    response_model=DepartmentDetailResponse,
    dependencies=[
        audit_activity(
            "department.new", "{{ actor.name }} opened new department form"
        )
    ],
)
async def get_department_new(
    request_body: DepartmentNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get default department detail for creation mode."""
    tags = ["departments"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DepartmentDetailResponse.model_validate(cached["data"])

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

        sql_query = load_sql("sql/v3/departments/get_department_default_complete.sql")
        sql_params = (profile_id,)
        result = await conn.fetchrow(sql_query, profile_id)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Profile {profile_id} not found"
            )

        is_superadmin = result["profile_role"] == "superadmin"

        # Set audit context
        actor_name = result.get("actor_name")
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Parse settings mapping from JSONB
        settings_mapping: dict[str, SettingsMappingItem] = {}
        settings_mapping_data = result.get("settings_mapping")
        if isinstance(settings_mapping_data, str):
            settings_mapping_data = json.loads(settings_mapping_data)
        if settings_mapping_data and isinstance(settings_mapping_data, dict):
            for sid, sdata in settings_mapping_data.items():
                if isinstance(sdata, dict):
                    department_ids = None
                    if sdata.get("department_ids"):
                        department_ids = [str(did) for did in sdata["department_ids"]]
                    settings_mapping[sid] = SettingsMappingItem(
                        settings_id=sdata.get("settings_id", sid),
                        created_at=sdata.get("created_at", ""),
                        active=sdata.get("active", True),
                        department_ids=department_ids,
                    )

        response_data = DepartmentDetailResponse(
            title="",
            description="",
            active=True,
            can_edit=is_superadmin,
            can_duplicate=False,
            can_delete=False,
            in_use=False,
            staff_count=0,
            total_price_spent=0.0,
            settings_id=None,
            settings_mapping=settings_mapping,
            cohort_mapping={},
            department_mapping={},
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
            operation="get_department_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
