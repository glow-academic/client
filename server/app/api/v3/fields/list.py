"""Fields list endpoint - v3 API."""

import json
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
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


class FieldsListRequest(BaseModel):
    """Request for fields list."""

    pass
    # profileId removed - comes from X-Profile-Id header


class FieldItem(BaseModel):
    """Field item for list view."""

    field_id: str
    name: str
    description: str
    active: bool
    department_ids: list[str] | None = None
    parameter_ids: list[str]
    conditional_parameter_ids: list[str]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class FieldsListResponse(BaseModel):
    """Response for fields list."""

    fields: list[FieldItem]
    parameter_mapping: dict[str, dict[str, str]]
    department_mapping: dict[str, DepartmentMappingItem]
    # UI-ready facet options (precomputed on server)
    parameter_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


def disambiguate_parameters(pmap: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    """Build parameter options with disambiguation for duplicate names."""
    names = Counter([v.get("name", "") for v in pmap.values()])
    out = []
    for pid, v in pmap.items():
        label = v.get("name", "")
        if names[label] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.get('name', '')} ({pid[-8:]})"
        out.append({"value": pid, "label": label})
    return out


@router.post(
    "/list",
    response_model=FieldsListResponse,
    dependencies=[
        audit_activity("fields.list", "{{ actor.name }} visited the Fields page")
    ],
)
async def get_fields_list(
    filters: FieldsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FieldsListResponse:
    """Get fields list with permissions and relationships."""
    tags = ["fields"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return FieldsListResponse.model_validate(cached["data"])

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

        sql_query = load_sql("sql/v3/fields/list_fields.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        fields = []
        parameter_mapping: dict[str, dict[str, str]] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}

        for row in rows:
            # Convert UUID arrays to string arrays
            parameter_ids = [str(pid) for pid in (row["parameter_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Parse conditional_parameter_ids from array
            conditional_parameter_ids: list[str] = []
            cond_param_ids_raw = row.get("conditional_parameter_ids")
            if cond_param_ids_raw and isinstance(cond_param_ids_raw, (list, tuple)):
                conditional_parameter_ids = [
                    str(pid) for pid in cond_param_ids_raw if pid
                ]

            fields.append(
                FieldItem(
                    field_id=str(row["field_id"]),
                    name=row["name"],
                    description=row["description"],
                    active=row.get("active", True),
                    department_ids=dept_ids,
                    parameter_ids=parameter_ids,
                    conditional_parameter_ids=conditional_parameter_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

            # Parse mappings from first row (same for all fields)
            if not parameter_mapping and row["parameter_mapping"]:
                param_data = row["parameter_mapping"]
                if isinstance(param_data, str):
                    param_data = json.loads(param_data)
                if isinstance(param_data, dict):
                    parameter_mapping = param_data

            if not department_mapping and row["department_mapping"]:
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

        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Get user departments for scoping facet options
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            profile_id,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        # Build facet options
        # Filter parameter_options to only include parameters associated with fields
        assigned_parameter_ids = set()
        assigned_department_ids = set()
        for field in fields:
            assigned_parameter_ids.update(field.parameter_ids)
            if field.department_ids:
                assigned_department_ids.update(field.department_ids)

        parameter_options = [
            opt
            for opt in disambiguate_parameters(parameter_mapping)
            if opt["value"] in assigned_parameter_ids
        ]

        # Filter department_options to only include departments assigned to fields AND in user's departments
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids and did in user_department_ids
        ]

        response_data = FieldsListResponse(
            fields=fields,
            parameter_mapping=parameter_mapping,
            department_mapping=department_mapping,
            parameter_options=parameter_options,
            department_options=department_options,
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
            operation="get_fields_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
