"""Key detail endpoint - v3 API following DHH principles."""

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


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class KeyDetailRequest(BaseModel):
    """Request for key detail."""

    keyId: str
    profileId: str


class KeyDetailResponse(BaseModel):
    """Response for key detail endpoint."""

    key_id: str
    name: str
    key_masked: str
    type: str
    active: bool
    created_at: str
    updated_at: str
    department_ids: list[str]
    model_ids: list[str]
    valid_department_ids: list[str]
    can_edit: bool
    department_mapping: dict[str, DepartmentMappingItem]
    model_mapping: dict[str, dict[str, Any]]


router = APIRouter()


@router.post("/detail", response_model=KeyDetailResponse)
async def get_key_detail(
    request_body: KeyDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> KeyDetailResponse:
    """Get key detail information."""
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
        sql_query = load_sql("sql/v3/keys/get_key_detail_complete.sql")
        sql_params = (
            uuid.UUID(request_body.keyId),
            uuid.UUID(request_body.profileId),
        )
        row = await conn.fetchrow(
            sql_query,
            uuid.UUID(request_body.keyId),
            uuid.UUID(request_body.profileId),
        )

        if not row:
            # Check if key exists but user doesn't have department access
            key_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM keys WHERE id = $1)",
                uuid.UUID(request_body.keyId),
            )
            if key_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this key. It may be restricted to other departments.",
                )
            raise HTTPException(status_code=404, detail="Key not found")

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

        # Parse model mapping
        model_mapping: dict[str, dict[str, Any]] = {}
        if row.get("model_mapping"):
            model_data = row["model_mapping"]
            if isinstance(model_data, str):
                model_data = json.loads(model_data)
            if isinstance(model_data, dict):
                model_mapping = model_data

        # Get can_edit from SQL (handles default objects and role checks)
        can_edit = row.get("can_edit", False)

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        dept_ids = []
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        model_ids = []
        if row.get("model_ids"):
            model_ids = [str(mid) for mid in row["model_ids"]]

        response_data = KeyDetailResponse(
            key_id=str(row.get("key_id", "")),
            name=row.get("name", ""),
            key_masked=row.get("key_masked", "****"),
            type=row.get("type", "api"),
            active=row.get("active", False),
            created_at=row.get("created_at").isoformat()
            if row.get("created_at")
            else "",
            updated_at=row.get("updated_at").isoformat()
            if row.get("updated_at")
            else "",
            department_ids=dept_ids,
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
            operation="get_key_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
