"""Field new endpoint for create page."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class FieldNewRequest(BaseModel):
    """Request to get default field detail for creation mode."""

    # profileId removed - comes from X-Profile-Id header


class ParameterMappingItem(BaseModel):
    name: str
    description: str


class DepartmentMappingItem(BaseModel):
    name: str
    description: str


class FieldNewResponse(BaseModel):
    valid_department_ids: list[str]
    department_mapping: dict[str, DepartmentMappingItem]
    valid_parameter_ids: list[str]
    parameter_mapping: dict[str, ParameterMappingItem]
    user_role: str
    primary_department_id: str | None


router = APIRouter()


@router.post(
    "/new",
    response_model=FieldNewResponse,
    dependencies=[
        audit_activity("field.new", "{{ actor.name }} opened new field form")
    ],
)
async def get_field_new(
    request: FieldNewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FieldNewResponse:
    """Get default field detail for creation mode."""
    tags = ["fields"]

    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return FieldNewResponse.model_validate(cached["data"])

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

        sql_query = load_sql("sql/v3/fields/get_field_new_complete.sql")
        sql_params = (profile_id,)
        result = await conn.fetchrow(sql_query, profile_id)

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to fetch field detail data"
            )

        # Set audit context
        actor_name = result.get("actor_name")
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Parse valid_department_ids
        valid_department_ids: list[str] = []
        valid_dept_ids_raw = result.get("valid_department_ids")
        if valid_dept_ids_raw and isinstance(valid_dept_ids_raw, (list, tuple)):
            valid_department_ids = [str(did) for did in valid_dept_ids_raw if did]

        # Parse department_mapping
        department_mapping: dict[str, DepartmentMappingItem] = {}
        dept_mapping_data = result.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse valid_parameter_ids
        valid_parameter_ids: list[str] = []
        valid_param_ids_raw = result.get("valid_parameter_ids")
        if valid_param_ids_raw and isinstance(valid_param_ids_raw, (list, tuple)):
            valid_parameter_ids = [str(pid) for pid in valid_param_ids_raw if pid]

        # Parse parameter_mapping
        parameter_mapping: dict[str, ParameterMappingItem] = {}
        param_mapping_data = result.get("parameter_mapping")
        if isinstance(param_mapping_data, str):
            param_mapping_data = json.loads(param_mapping_data)
        if param_mapping_data and isinstance(param_mapping_data, dict):
            for param_id, pdata in param_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[param_id] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                    )

        response_data = FieldNewResponse(
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            valid_parameter_ids=valid_parameter_ids,
            parameter_mapping=parameter_mapping,
            user_role=str(result.get("user_role", "")),
            primary_department_id=str(result.get("primary_department_id"))
            if result.get("primary_department_id")
            else None,
        )

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
            route_path=http_request.url.path,
            operation="get_field_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
