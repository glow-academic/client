"""Parameters list endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class ParametersFilters(BaseModel):
    profileId: str


class ParameterSampleItem(BaseModel):
    parameter_item_id: str
    name: str
    description: str
    value: str


class ParameterItem(BaseModel):
    parameter_id: str
    name: str
    description: str
    numerical: bool
    active: bool
    department_ids: list[str] | None
    num_items: int
    sample_items: list[ParameterSampleItem]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class ParametersListResponse(BaseModel):
    parameters: list[ParameterItem]
    department_mapping: dict[str, dict[str, Any]]


router = APIRouter()


@router.post("/list", response_model=ParametersListResponse)
async def get_parameters_list(
    filters: ParametersFilters,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ParametersListResponse:
    """Get parameters list with item counts and permissions."""
    tags = ["parameters"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ParametersListResponse.model_validate(cached["data"])
    
    try:
        sql = load_sql("sql/v3/parameters/list_parameters.sql")
        result = await conn.fetch(sql, filters.profileId)

        parameters = []
        department_mapping: dict[str, dict[str, Any]] = {}

        for row in result:
            # Parse sample items from JSONB
            sample_items = []
            if row.get("sample_items_json"):
                items_data = row["sample_items_json"]
                if isinstance(items_data, str):
                    items_data = json.loads(items_data)
                if isinstance(items_data, list):
                    for item_data in items_data:
                        if isinstance(item_data, dict):
                            sample_items.append(
                                ParameterSampleItem(
                                    parameter_item_id=item_data.get("parameter_item_id", ""),
                                    name=item_data.get("name", ""),
                                    description=item_data.get("description", ""),
                                    value=item_data.get("value", ""),
                                )
                            )

            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            parameters.append(
                ParameterItem(
                    parameter_id=str(row["parameter_id"]),
                    name=row["name"],
                    description=row["description"],
                    numerical=row["numerical"],
                    active=row["active"],
                    department_ids=dept_ids,
                    num_items=row["num_items"],
                    sample_items=sample_items,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

            # Parse department_mapping from first row
            if not department_mapping and row.get("department_mapping"):
                dm = row["department_mapping"]
                if isinstance(dm, str):
                    dm = json.loads(dm)
                if isinstance(dm, dict):
                    department_mapping = dm

        response_data = ParametersListResponse(
            parameters=parameters, department_mapping=department_mapping
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

