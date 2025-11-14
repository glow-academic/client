"""Parameter detail-default endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class ParameterDetailDefaultRequest(BaseModel):
    profileId: str


# Reuse models from detail.py (import after defining request to avoid circular import)
from app.api.v3.parameters.detail import (ParameterDetailResponse,
                                          ParameterItemDetail)

router = APIRouter()


@router.post("/detail-default", response_model=ParameterDetailResponse)
async def get_parameter_detail_default(
    request: ParameterDetailDefaultRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ParameterDetailResponse:
    """Get default parameter detail for creation mode."""
    tags = ["parameters"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        # Ensure can_edit is present in cached data (for backward compatibility)
        cached_data = cached["data"]
        if "can_edit" not in cached_data:
            cached_data["can_edit"] = True  # Default to True for new parameters
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ParameterDetailResponse.model_validate(cached_data)
    
    try:
        sql = load_sql("sql/v3/parameters/get_parameter_detail_default_complete.sql")
        result = await conn.fetchrow(sql, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail="No default parameter found for user"
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
            can_edit=result.get("can_edit", True),  # Default to True for new parameters
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
        raise HTTPException(status_code=500, detail=str(e))

