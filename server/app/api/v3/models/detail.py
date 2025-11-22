"""Model detail endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class ModelDetailRequest(BaseModel):
    modelId: str
    profileId: str


class DepartmentMappingItem(BaseModel):
    name: str
    description: str


class KeyMappingItem(BaseModel):
    name: str
    description: str
    key_masked: str
    active: bool
    department_ids: list[str] | None


class ModelDetailResponse(BaseModel):
    name: str
    description: str
    active: bool
    image_model: bool
    input_ppm: int
    output_ppm: int
    provider: str  # enum: 'openai', 'gemini', 'custom'
    base_url: str  # empty string if not custom model
    valid_providers: list[str]  # enum values
    valid_department_ids: list[str]
    department_mapping: dict[str, DepartmentMappingItem]
    department_ids: list[str]
    valid_key_ids: list[str]
    key_mapping: dict[str, KeyMappingItem]
    default_key_id: str | None


router = APIRouter()


@router.post("/detail", response_model=ModelDetailResponse)
async def get_model_detail(
    request: ModelDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelDetailResponse:
    """Get detailed model information."""
    tags = ["models"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ModelDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/models/get_model_detail_complete.sql")
        sql_params = (request.modelId, request.profileId)
        model = await conn.fetchrow(sql_query, request.modelId, request.profileId)

        if not model:
            raise HTTPException(
                status_code=404, detail=f"Model not found: {request.modelId}"
            )

        # Parse valid_providers from array (enum values)
        valid_providers: list[str] = []
        valid_providers_raw = model.get("valid_providers")
        if valid_providers_raw and isinstance(valid_providers_raw, (list, tuple)):
            valid_providers = [str(p) for p in valid_providers_raw if p]

        # Parse valid_department_ids from array
        valid_department_ids: list[str] = []
        valid_department_ids_raw = model.get("valid_department_ids")
        if valid_department_ids_raw and isinstance(valid_department_ids_raw, (list, tuple)):
            valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

        # Parse department_mapping from JSONB
        department_mapping: dict[str, DepartmentMappingItem] = {}
        department_mapping_data = model.get("department_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse department_ids from array - always ensure it's a list
        department_ids_raw = model.get("department_ids")
        if department_ids_raw is None:
            department_ids: list[str] = []
        elif isinstance(department_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in department_ids_raw if did]
        elif hasattr(department_ids_raw, '__iter__') and not isinstance(department_ids_raw, str):
            # Handle asyncpg array types
            department_ids = [str(did) for did in department_ids_raw if did]
        else:
            # Fallback to empty list for any other type
            department_ids = []

        # Parse valid_key_ids from array
        valid_key_ids: list[str] = []
        valid_key_ids_raw = model.get("valid_key_ids")
        if valid_key_ids_raw and isinstance(valid_key_ids_raw, (list, tuple)):
            valid_key_ids = [str(kid) for kid in valid_key_ids_raw if kid]

        # Parse key_mapping from JSONB
        key_mapping: dict[str, KeyMappingItem] = {}
        key_mapping_data = model.get("key_mapping")
        if isinstance(key_mapping_data, str):
            key_mapping_data = json.loads(key_mapping_data)
        if key_mapping_data and isinstance(key_mapping_data, dict):
            for key_id, kdata in key_mapping_data.items():
                if isinstance(kdata, dict):
                    # Parse department_ids from array
                    department_ids: list[str] | None = None
                    dept_ids_raw = kdata.get("department_ids")
                    if dept_ids_raw is not None:
                        if isinstance(dept_ids_raw, (list, tuple)):
                            dept_ids_list = [str(did) for did in dept_ids_raw if did]
                            department_ids = dept_ids_list if dept_ids_list else None
                        # If it's an empty array or None, keep as None
                    
                    key_mapping[key_id] = KeyMappingItem(
                        name=kdata.get("name", ""),
                        description=kdata.get("description", ""),
                        key_masked=kdata.get("key_masked", ""),
                        active=kdata.get("active", True),
                        department_ids=department_ids,
                    )

        default_key_id = str(model.get("default_key_id")) if model.get("default_key_id") else None

        # Ensure department_ids is always a list, never None
        final_department_ids = department_ids if isinstance(department_ids, list) else []

        response_data = ModelDetailResponse(
            name=model["name"],
            description=model["description"],
            active=model["active"],
            image_model=model["image_model"],
            input_ppm=int(model["input_ppm"]) if model["input_ppm"] else 0,
            output_ppm=int(model["output_ppm"]) if model["output_ppm"] else 0,
            provider=str(model["provider"]),
            base_url=str(model.get("base_url", "")),
            valid_providers=valid_providers,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_ids=final_department_ids,
            valid_key_ids=valid_key_ids,
            key_mapping=key_mapping,
            default_key_id=default_key_id,
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
            operation="get_model_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

