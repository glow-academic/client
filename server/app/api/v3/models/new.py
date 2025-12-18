"""Model new endpoint for create page."""

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
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ModelNewRequest(BaseModel):
    pass
    # profileId removed - comes from X-Profile-Id header


class ProviderMappingItem(BaseModel):
    name: str
    description: str


class DepartmentMappingItem(BaseModel):
    name: str
    description: str


class KeyMappingItem(BaseModel):
    name: str
    description: str
    key_masked: str
    active: bool
    department_ids: list[str] | None


class ModelMappingItem(BaseModel):
    name: str
    description: str


class UnitItem(BaseModel):
    id: str
    name: str
    unit_category: str  # 'tokens' | 'seconds' | 'units'
    value: int


class ModelNewResponse(BaseModel):
    valid_provider_ids: list[str]
    provider_mapping: dict[str, ProviderMappingItem]
    valid_department_ids: list[str]
    department_mapping: dict[str, DepartmentMappingItem]
    valid_model_ids: list[str]
    model_mapping: dict[str, ModelMappingItem]
    valid_key_ids: list[str]
    key_mapping: dict[str, KeyMappingItem]
    units: list[UnitItem]
    user_role: str
    primary_department_id: str | None


router = APIRouter()


@router.post("/new", response_model=ModelNewResponse)
async def get_model_new(
    request: ModelNewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelNewResponse:
    """Get default model detail for creation mode (provider mapping)."""
    tags = ["models"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ModelNewResponse.model_validate(cached["data"])

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

        sql_query = load_sql("sql/v3/models/get_model_new_complete.sql")
        sql_params = (profile_id,)
        result = await conn.fetchrow(sql_query, profile_id)

        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to fetch model detail data"
            )

        # Parse valid_provider_ids from array
        valid_provider_ids: list[str] = []
        valid_provider_ids_raw = result.get("valid_provider_ids")
        if valid_provider_ids_raw and isinstance(valid_provider_ids_raw, (list, tuple)):
            valid_provider_ids = [str(pid) for pid in valid_provider_ids_raw if pid]
        elif isinstance(valid_provider_ids_raw, str):
            # Handle JSON string
            valid_provider_ids_raw = json.loads(valid_provider_ids_raw)
            if isinstance(valid_provider_ids_raw, list):
                valid_provider_ids = [str(pid) for pid in valid_provider_ids_raw if pid]

        # Parse provider_mapping from JSONB
        provider_mapping: dict[str, ProviderMappingItem] = {}
        provider_mapping_data = result.get("provider_mapping")
        if isinstance(provider_mapping_data, str):
            provider_mapping_data = json.loads(provider_mapping_data)
        if provider_mapping_data and isinstance(provider_mapping_data, dict):
            for provider_id, pdata in provider_mapping_data.items():
                if isinstance(pdata, dict):
                    provider_mapping[provider_id] = ProviderMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                    )

        # Parse valid_department_ids from array
        valid_department_ids: list[str] = []
        valid_department_ids_raw = result.get("valid_department_ids")
        if valid_department_ids_raw and isinstance(
            valid_department_ids_raw, (list, tuple)
        ):
            valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

        # Parse department_mapping from JSONB
        department_mapping: dict[str, DepartmentMappingItem] = {}
        department_mapping_data = result.get("department_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse valid_model_ids from array
        valid_model_ids: list[str] = []
        valid_model_ids_raw = result.get("valid_model_ids")
        if valid_model_ids_raw and isinstance(valid_model_ids_raw, (list, tuple)):
            valid_model_ids = [str(mid) for mid in valid_model_ids_raw if mid]

        # Parse model_mapping from JSONB
        model_mapping: dict[str, ModelMappingItem] = {}
        model_mapping_data = result.get("model_mapping")
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if model_mapping_data and isinstance(model_mapping_data, dict):
            for model_id, mdata in model_mapping_data.items():
                if isinstance(mdata, dict):
                    model_mapping[model_id] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
                    )

        # Parse valid_key_ids from array
        valid_key_ids: list[str] = []
        valid_key_ids_raw = result.get("valid_key_ids")
        if valid_key_ids_raw and isinstance(valid_key_ids_raw, (list, tuple)):
            valid_key_ids = [str(kid) for kid in valid_key_ids_raw if kid]

        # Parse key_mapping from JSONB
        key_mapping: dict[str, KeyMappingItem] = {}
        key_mapping_data = result.get("key_mapping")
        if isinstance(key_mapping_data, str):
            key_mapping_data = json.loads(key_mapping_data)
        if key_mapping_data and isinstance(key_mapping_data, dict):
            for key_id, kdata in key_mapping_data.items():
                if isinstance(kdata, dict):
                    # Parse department_ids from array
                    department_ids: list[str] | None = None
                    dept_ids_raw = kdata.get("department_ids")
                    if dept_ids_raw and isinstance(dept_ids_raw, (list, tuple)):
                        department_ids = [str(did) for did in dept_ids_raw if did]

                    key_mapping[key_id] = KeyMappingItem(
                        name=kdata.get("name", ""),
                        description=kdata.get("description", ""),
                        key_masked=kdata.get("key_masked", ""),
                        active=kdata.get("active", True),
                        department_ids=department_ids,
                    )

        # Parse units
        units: list[UnitItem] = []
        units_raw = result.get("units")
        if isinstance(units_raw, str):
            units_raw = json.loads(units_raw)
        if units_raw and isinstance(units_raw, list):
            for u in units_raw:
                if isinstance(u, dict):
                    units.append(
                        UnitItem(
                            id=str(u.get("id", "")),
                            name=str(u.get("name", "")),
                            unit_category=str(u.get("unit_category", "")),
                            value=int(u.get("value", 0)),
                        )
                    )

        response_data = ModelNewResponse(
            valid_provider_ids=valid_provider_ids,
            provider_mapping=provider_mapping,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            valid_model_ids=valid_model_ids,
            model_mapping=model_mapping,
            valid_key_ids=valid_key_ids,
            key_mapping=key_mapping,
            units=units,
            user_role=str(result.get("user_role", "")),
            primary_department_id=str(result.get("primary_department_id"))
            if result.get("primary_department_id")
            else None,
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
            operation="get_model_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
