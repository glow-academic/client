"""Parameter new endpoint."""

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
class ParameterNewRequest(BaseModel):
    profileId: str


# Reuse models from detail.py (import after defining request to avoid circular import)
from app.api.v3.parameters.detail import (  # noqa: E402
    FieldConnection,
    ParameterDetailResponse,
    ParameterItemDetail,
)

router = APIRouter()


@router.post("/new", response_model=ParameterDetailResponse)
async def get_parameter_new(
    request: ParameterNewRequest,
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

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/parameters/get_parameter_new_complete.sql")
        sql_params = (request.profileId,)
        result = await conn.fetchrow(sql_query, request.profileId)

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
                            default=item_data.get("default", False),
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

        # Parse field_mapping from JSONB
        field_mapping: dict[str, dict[str, Any]] = {}
        field_mapping_data = result.get("field_mapping")
        if isinstance(field_mapping_data, str):
            field_mapping_data = json.loads(field_mapping_data)
        if field_mapping_data and isinstance(field_mapping_data, dict):
            field_mapping = field_mapping_data

        # Parse valid_field_ids from array
        valid_field_ids: list[str] = []
        valid_field_ids_raw = result.get("valid_field_ids")
        if valid_field_ids_raw and isinstance(valid_field_ids_raw, (list, tuple)):
            valid_field_ids = [str(fid) for fid in valid_field_ids_raw if fid]

        # Parse field_connections from JSONB
        field_connections: list[FieldConnection] = []
        field_connections_data = result.get("field_connections_json")
        if isinstance(field_connections_data, str):
            field_connections_data = json.loads(field_connections_data)
        if field_connections_data and isinstance(field_connections_data, list):
            for conn_data in field_connections_data:
                if isinstance(conn_data, dict):
                    field_connections.append(
                        FieldConnection(
                            field_id=str(conn_data.get("field_id", "")),
                            default=conn_data.get("default", False),
                            active=conn_data.get("active", True),
                        )
                    )

        # Parse persona_mapping from JSONB
        persona_mapping: dict[str, dict[str, Any]] = {}
        persona_mapping_data = result.get("persona_mapping")
        if isinstance(persona_mapping_data, str):
            persona_mapping_data = json.loads(persona_mapping_data)
        if persona_mapping_data and isinstance(persona_mapping_data, dict):
            persona_mapping = persona_mapping_data

        # Parse valid_persona_ids from array
        valid_persona_ids: list[str] = []
        valid_persona_ids_raw = result.get("valid_persona_ids")
        if valid_persona_ids_raw and isinstance(valid_persona_ids_raw, (list, tuple)):
            valid_persona_ids = [str(pid) for pid in valid_persona_ids_raw if pid]

        # Parse document_mapping from JSONB
        document_mapping: dict[str, dict[str, Any]] = {}
        document_mapping_data = result.get("document_mapping")
        if isinstance(document_mapping_data, str):
            document_mapping_data = json.loads(document_mapping_data)
        if document_mapping_data and isinstance(document_mapping_data, dict):
            document_mapping = document_mapping_data

        # Parse valid_document_ids from array
        valid_document_ids: list[str] = []
        valid_document_ids_raw = result.get("valid_document_ids")
        if valid_document_ids_raw and isinstance(valid_document_ids_raw, (list, tuple)):
            valid_document_ids = [str(did) for did in valid_document_ids_raw if did]

        # Get user role and primary department for default behavior
        user_role = result.get("user_role", "trainee")
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.get("primary_department_id")

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            department_ids = None
        else:
            department_ids = [primary_department_id] if primary_department_id else []

        is_default = department_ids is None or len(department_ids) == 0
        # Default parameters (no department_ids) are read-only for non-superadmin
        can_edit = not (is_default and not is_superadmin) and user_role in (
            "admin",
            "superadmin",
        )

        response_data = ParameterDetailResponse(
            name=result["name"],
            description=result["description"],
            active=result["active"],
            simulation_parameter=result.get("simulation_parameter", False),
            document_parameter=result.get("document_parameter", False),
            persona_parameter=result.get("persona_parameter", False),
            scenario_parameter=result.get("scenario_parameter", False),
            video_parameter=result.get("video_parameter", False),
            department_ids=department_ids,
            parameter_items=parameter_items,
            department_mapping=department_mapping,
            valid_department_ids=valid_department_ids,
            field_mapping=field_mapping,
            valid_field_ids=valid_field_ids,
            field_connections=field_connections,
            persona_ids=valid_persona_ids,
            persona_mapping=persona_mapping,
            valid_persona_ids=valid_persona_ids,
            document_ids=valid_document_ids,
            document_mapping=document_mapping,
            valid_document_ids=valid_document_ids,
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
            operation="get_parameter_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
