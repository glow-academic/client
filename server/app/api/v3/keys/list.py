"""Keys list endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


class KeysListRequest(BaseModel):
    """Request for keys list."""

    pass
    # profileId removed - comes from X-Profile-Id header


class KeyItem(BaseModel):
    """Key item for list view."""

    key_id: str
    name: str
    key_masked: str
    description: str
    active: bool
    created_at: str
    updated_at: str
    department_ids: list[str] | None
    model_ids: list[str]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class KeysListResponse(BaseModel):
    """Response for keys list."""

    keys: list[KeyItem]
    department_options: list[dict[str, str]]
    model_options: list[dict[str, str]]
    department_mapping: dict[str, dict[str, str]]
    model_mapping: dict[str, dict[str, Any]]


router = APIRouter()


@router.post(
    "/list",
    response_model=KeysListResponse,
    dependencies=[
        audit_activity("keys.list", "{{ actor.name }} visited the Keys page")
    ],
)
async def get_keys_list(
    filters: KeysListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> KeysListResponse:
    """Get keys list with permissions and relationships."""
    tags = ["keys"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return KeysListResponse.model_validate(cached["data"])

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

        sql_query = load_sql("app/sql/v3/keys/list_keys.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        keys = []
        department_mapping: dict[str, dict[str, str]] = {}
        model_mapping: dict[str, dict[str, Any]] = {}
        department_options: list[dict[str, str]] = []
        model_options: list[dict[str, str]] = []

        for row in rows:
            # Convert UUID arrays to string arrays
            department_ids = None
            if row.get("department_ids"):
                department_ids = [str(did) for did in row["department_ids"]]

            model_ids = [str(mid) for mid in (row.get("model_ids") or [])]

            keys.append(
                KeyItem(
                    key_id=str(row["key_id"]),
                    name=row["name"],
                    key_masked=row["key_masked"],
                    description=row.get("description", ""),
                    active=row["active"],
                    created_at=row["created_at"].isoformat()
                    if row.get("created_at")
                    else "",
                    updated_at=row["updated_at"].isoformat()
                    if row.get("updated_at")
                    else "",
                    department_ids=department_ids,
                    model_ids=model_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

            # Parse mappings from first row (same for all keys)
            if not department_mapping and row.get("department_mapping"):
                dept_data = row["department_mapping"]
                if isinstance(dept_data, str):
                    dept_data = json.loads(dept_data)
                if isinstance(dept_data, dict):
                    department_mapping = dept_data

            if not model_mapping and row.get("model_mapping"):
                model_data = row["model_mapping"]
                if isinstance(model_data, str):
                    model_data = json.loads(model_data)
                if isinstance(model_data, dict):
                    model_mapping = model_data

            # Parse facet options from first row
            if not department_options and row.get("department_options"):
                dept_opts = row["department_options"]
                if isinstance(dept_opts, str):
                    dept_opts = json.loads(dept_opts)
                if isinstance(dept_opts, list):
                    department_options = dept_opts

            if not model_options and row.get("model_options"):
                model_opts = row["model_options"]
                if isinstance(model_opts, str):
                    model_opts = json.loads(model_opts)
                if isinstance(model_opts, list):
                    model_options = model_opts

        response_data = KeysListResponse(
            keys=keys,
            department_options=department_options,
            model_options=model_options,
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
            operation="get_keys_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
