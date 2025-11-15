"""Parameter detail endpoint."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class ParameterDetailRequest(BaseModel):
    parameterId: str
    profileId: str


class ParameterItemDetail(BaseModel):
    parameter_item_id: str
    name: str
    description: str
    value: str
    usage_count: int
    department_ids: list[str] | None


class ParameterDetailResponse(BaseModel):
    name: str
    description: str
    numerical: bool
    active: bool
    document_parameter: bool
    practice_parameter: bool
    department_ids: list[str] | None
    parameter_items: list[ParameterItemDetail]
    department_mapping: dict[str, dict[str, Any]]
    valid_department_ids: list[str]
    can_edit: bool


router = APIRouter()


@router.post("/detail", response_model=ParameterDetailResponse)
async def get_parameter_detail(
    request: ParameterDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ParameterDetailResponse:
    """Get detailed parameter information with nested items."""
    tags = ["parameters"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        # Ensure can_edit is present in cached data (for backward compatibility)
        cached_data = cached["data"]
        if "can_edit" not in cached_data:
            cached_data["can_edit"] = False  # Default to False, will be overridden by SQL query
        return ParameterDetailResponse.model_validate(cached_data)
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/parameters/get_parameter_detail_complete.sql")
        sql_params = (uuid.UUID(request.parameterId), request.profileId)
        result = await conn.fetchrow(sql_query, uuid.UUID(request.parameterId), request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Parameter not found: {request.parameterId}"
            )

        # Parse parameter_items from JSONB
        parameter_items: list[ParameterItemDetail] = []
        items_data = result.get("parameter_items_json")
        if isinstance(items_data, str):
            items_data = json.loads(items_data)
        if items_data and isinstance(items_data, list):
            for item_data in items_data:
                if isinstance(item_data, dict):
                    dept_ids = None
                    if item_data.get("department_ids"):
                        dept_ids = [str(d) for d in item_data["department_ids"]]
                    parameter_items.append(
                        ParameterItemDetail(
                            parameter_item_id=item_data.get("parameter_item_id", ""),
                            name=item_data.get("name", ""),
                            description=item_data.get("description", ""),
                            value=item_data.get("value", ""),
                            usage_count=item_data.get("usage_count", 0),
                            department_ids=dept_ids,
                        )
                    )

        # Parse department_mapping from JSONB
        department_mapping: dict[str, dict[str, Any]] = {}
        dept_mapping_data = result.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            department_mapping = dept_mapping_data

        # Parse valid_department_ids from array
        valid_department_ids: list[str] = []
        valid_dept_ids_raw = result.get("valid_department_ids")
        if valid_dept_ids_raw and isinstance(valid_dept_ids_raw, (list, tuple)):
            valid_department_ids = [str(did) for did in valid_dept_ids_raw if did]

        # Parse department_ids from array
        department_ids = None
        dept_ids_raw = result.get("department_ids")
        if dept_ids_raw and isinstance(dept_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in dept_ids_raw if did]

        response_data = ParameterDetailResponse(
            name=result["name"],
            description=result["description"],
            numerical=result["numerical"],
            active=result["active"],
            document_parameter=result["document_parameter"],
            practice_parameter=result["practice_parameter"],
            department_ids=department_ids,
            parameter_items=parameter_items,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
            can_edit=result.get("can_edit", False),
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
            operation="get_parameter_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

