"""Department detail endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class CohortMappingItem(BaseModel):
    """Cohort mapping item."""

    name: str
    description: str
from app.utils.sql_helper import load_sql


class DepartmentDetailRequest(BaseModel):
    """Request for department detail."""

    departmentId: str
    profileId: str


class SettingsMappingItem(BaseModel):
    """Settings mapping item."""

    settings_id: str
    created_at: str
    active: bool
    department_ids: list[str] | None = None


class ModelMappingItem(BaseModel):
    """Model mapping item."""

    name: str
    description: str


class KeyMappingItem(BaseModel):
    """Key mapping item."""

    name: str
    description: str
    key_masked: str
    active: bool


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
    valid_department_ids: list[str]
    valid_model_ids: list[str]
    model_mapping: dict[str, ModelMappingItem]
    valid_key_ids: list[str]
    key_mapping: dict[str, KeyMappingItem]
    model_key_mapping: dict[str, str]  # model_id -> key_id


router = APIRouter()


@router.post("/detail", response_model=DepartmentDetailResponse)
async def get_department_detail(
    request_body: DepartmentDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentDetailResponse:
    """Get department detail with permissions, stats, and settings."""
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
        sql_query = load_sql("sql/v3/departments/get_department_detail_with_staff.sql")
        sql_params = (request_body.departmentId, request_body.profileId)
        dept_row = await conn.fetchrow(
            sql_query, request_body.departmentId, request_body.profileId
        )

        if not dept_row:
            # Check if department exists but user doesn't have department access
            department_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM departments WHERE id = $1)",
                request_body.departmentId,
            )
            if department_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this department. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404,
                detail=f"Department {request_body.departmentId} not found",
            )

        # Get settings_id (can be None if no settings assigned)
        settings_id = dept_row.get("settings_id")

        # Parse settings mapping from JSONB
        settings_mapping: dict[str, SettingsMappingItem] = {}
        settings_mapping_data = dept_row.get("settings_mapping")
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

        # Parse cohort mapping from JSONB
        cohort_mapping = {}
        cohort_mapping_data = dept_row.get("cohort_mapping")
        if isinstance(cohort_mapping_data, str):
            cohort_mapping_data = json.loads(cohort_mapping_data)
        if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
            for cid, cdata in cohort_mapping_data.items():
                if isinstance(cdata, dict):
                    cohort_mapping[cid] = CohortMappingItem(
                        name=cdata.get("name", ""),
                        description=cdata.get("description", ""),
                    )

        # Parse department mapping from JSONB
        department_mapping = {}
        dept_mapping_data = dept_row.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Get valid_department_ids from department_mapping keys
        valid_department_ids = list(department_mapping.keys())

        # Parse model mapping from JSONB
        model_mapping: dict[str, ModelMappingItem] = {}
        model_mapping_data = dept_row.get("model_mapping")
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if model_mapping_data and isinstance(model_mapping_data, dict):
            for mid, mdata in model_mapping_data.items():
                if isinstance(mdata, dict):
                    model_mapping[mid] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
                    )

        # Parse valid_model_ids from array
        valid_model_ids: list[str] = []
        valid_model_ids_raw = dept_row.get("valid_model_ids")
        if valid_model_ids_raw and isinstance(valid_model_ids_raw, (list, tuple)):
            valid_model_ids = [str(mid) for mid in valid_model_ids_raw if mid]

        # Parse key mapping from JSONB
        key_mapping: dict[str, KeyMappingItem] = {}
        key_mapping_data = dept_row.get("key_mapping")
        if isinstance(key_mapping_data, str):
            key_mapping_data = json.loads(key_mapping_data)
        if key_mapping_data and isinstance(key_mapping_data, dict):
            for kid, kdata in key_mapping_data.items():
                if isinstance(kdata, dict):
                    key_mapping[kid] = KeyMappingItem(
                        name=kdata.get("name", ""),
                        description=kdata.get("description", ""),
                        key_masked=kdata.get("key_masked", ""),
                        active=kdata.get("active", True),
                    )

        # Parse valid_key_ids from array
        valid_key_ids: list[str] = []
        valid_key_ids_raw = dept_row.get("valid_key_ids")
        if valid_key_ids_raw and isinstance(valid_key_ids_raw, (list, tuple)):
            valid_key_ids = [str(kid) for kid in valid_key_ids_raw if kid]

        # Parse model_key_mapping from JSONB
        model_key_mapping: dict[str, str] = {}
        model_key_mapping_data = dept_row.get("model_key_mapping")
        if isinstance(model_key_mapping_data, str):
            model_key_mapping_data = json.loads(model_key_mapping_data)
        if model_key_mapping_data and isinstance(model_key_mapping_data, dict):
            for mid, kid in model_key_mapping_data.items():
                if kid:
                    model_key_mapping[mid] = str(kid)

        # Ensure can_delete is stricter than can_edit
        can_edit = dept_row["can_edit"]
        can_delete = dept_row["can_delete"] and can_edit

        response_data = DepartmentDetailResponse(
            title=dept_row["title"],
            description=dept_row["description"],
            active=dept_row["active"],
            can_edit=can_edit,
            can_duplicate=dept_row["can_duplicate"],
            can_delete=can_delete,
            in_use=dept_row["in_use"],
            staff_count=int(dept_row["staff_count"]),
            total_price_spent=float(dept_row["total_price_spent"]),
            settings_id=settings_id,
            settings_mapping=settings_mapping,
            cohort_mapping=cohort_mapping,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
            valid_model_ids=valid_model_ids,
            model_mapping=model_mapping,
            valid_key_ids=valid_key_ids,
            key_mapping=key_mapping,
            model_key_mapping=model_key_mapping,
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
            operation="get_department_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
