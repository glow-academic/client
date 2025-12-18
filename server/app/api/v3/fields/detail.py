"""Field detail endpoint."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class FieldDetailRequest(BaseModel):
    fieldId: str
    # profileId removed - comes from X-Profile-Id header


class FieldDetailResponse(BaseModel):
    name: str
    description: str
    active: bool
    department_ids: list[str] | None
    parameter_ids: list[str]
    conditional_parameter_ids: list[str]
    department_mapping: dict[str, dict[str, Any]]
    valid_department_ids: list[str]
    parameter_mapping: dict[str, dict[str, str]]
    valid_parameter_ids: list[str]
    can_edit: bool


router = APIRouter()


@router.post("/detail", response_model=FieldDetailResponse)
async def get_field_detail(
    request: FieldDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FieldDetailResponse:
    """Get detailed field information."""
    tags = ["fields"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        cached_data = cached["data"]
        if "can_edit" not in cached_data:
            cached_data["can_edit"] = False
        return FieldDetailResponse.model_validate(cached_data)

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

        sql_query = load_sql("sql/v3/fields/get_field_detail_complete.sql")
        sql_params = (uuid.UUID(request.fieldId), profile_id)
        result = await conn.fetchrow(sql_query, uuid.UUID(request.fieldId), profile_id)

        if not result:
            # Check if field exists but user doesn't have department access
            field_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM fields WHERE id = $1)",
                uuid.UUID(request.fieldId),
            )
            if field_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this field. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Field not found: {request.fieldId}"
            )

        # Parse department_mapping from JSONB
        department_mapping: dict[str, dict[str, Any]] = {}
        dept_mapping_data = result.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            department_mapping = dept_mapping_data

        # Parse parameter_mapping from JSONB
        parameter_mapping: dict[str, dict[str, str]] = {}
        param_mapping_data = result.get("parameter_mapping")
        if isinstance(param_mapping_data, str):
            param_mapping_data = json.loads(param_mapping_data)
        if param_mapping_data and isinstance(param_mapping_data, dict):
            parameter_mapping = param_mapping_data

        # Parse valid_department_ids from array
        valid_department_ids: list[str] = []
        valid_dept_ids_raw = result.get("valid_department_ids")
        if valid_dept_ids_raw and isinstance(valid_dept_ids_raw, (list, tuple)):
            valid_department_ids = [str(did) for did in valid_dept_ids_raw if did]

        # Parse valid_parameter_ids from array
        valid_parameter_ids: list[str] = []
        valid_param_ids_raw = result.get("valid_parameter_ids")
        if valid_param_ids_raw and isinstance(valid_param_ids_raw, (list, tuple)):
            valid_parameter_ids = [str(pid) for pid in valid_param_ids_raw if pid]

        # Parse department_ids from array
        department_ids = None
        dept_ids_raw = result.get("department_ids")
        if dept_ids_raw and isinstance(dept_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in dept_ids_raw if did]

        # Parse parameter_ids from array
        parameter_ids: list[str] = []
        param_ids_raw = result.get("parameter_ids")
        if param_ids_raw and isinstance(param_ids_raw, (list, tuple)):
            parameter_ids = [str(pid) for pid in param_ids_raw if pid]

        # Get can_edit from SQL
        can_edit = result.get("can_edit", False)

        # Parse conditional_parameter_ids from array
        conditional_parameter_ids: list[str] = []
        cond_param_ids_raw = result.get("conditional_parameter_ids")
        if cond_param_ids_raw and isinstance(cond_param_ids_raw, (list, tuple)):
            conditional_parameter_ids = [str(pid) for pid in cond_param_ids_raw if pid]

        response_data = FieldDetailResponse(
            name=result["name"],
            description=result["description"],
            active=result.get("active", True),
            department_ids=department_ids,
            parameter_ids=parameter_ids,
            conditional_parameter_ids=conditional_parameter_ids,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
            parameter_mapping=parameter_mapping,
            valid_parameter_ids=valid_parameter_ids,
            can_edit=can_edit,
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
            route_path=http_request.url.path,
            operation="get_field_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
