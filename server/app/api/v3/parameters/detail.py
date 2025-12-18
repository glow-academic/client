"""Parameter detail endpoint."""

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
class ParameterDetailRequest(BaseModel):
    parameterId: str
    # profileId removed - comes from X-Profile-Id header


class ParameterItemDetail(BaseModel):
    parameter_item_id: str
    name: str
    description: str
    default: bool
    usage_count: int
    department_ids: list[str] | None


class FieldConnection(BaseModel):
    field_id: str
    default: bool
    active: bool


class ParameterDetailResponse(BaseModel):
    name: str
    description: str
    active: bool
    simulation_parameter: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    department_ids: list[str] | None
    parameter_items: list[ParameterItemDetail]  # For backward compatibility
    department_mapping: dict[str, dict[str, Any]]
    valid_department_ids: list[str]
    field_mapping: dict[str, dict[str, Any]]
    valid_field_ids: list[str]
    field_connections: list[FieldConnection]
    persona_ids: list[str]  # Linked persona IDs
    persona_mapping: dict[str, dict[str, Any]]
    valid_persona_ids: list[str]
    document_ids: list[str]  # Linked document IDs
    document_mapping: dict[str, dict[str, Any]]
    valid_document_ids: list[str]
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
            cached_data["can_edit"] = (
                False  # Default to False, will be overridden by SQL query
            )
        return ParameterDetailResponse.model_validate(cached_data)

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

        sql_query = load_sql("sql/v3/parameters/get_parameter_detail_complete.sql")
        sql_params = (uuid.UUID(request.parameterId), profile_id)
        result = await conn.fetchrow(
            sql_query, uuid.UUID(request.parameterId), profile_id
        )

        if not result:
            # Check if parameter exists but user doesn't have department access
            parameter_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM parameters WHERE id = $1)",
                uuid.UUID(request.parameterId),
            )
            if parameter_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this parameter. It may be restricted to other departments.",
                )
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

        # Parse department_ids from array
        department_ids = None
        dept_ids_raw = result.get("department_ids")
        if dept_ids_raw and isinstance(dept_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in dept_ids_raw if did]

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

        # Parse persona_ids from array (linked personas)
        persona_ids: list[str] = []
        persona_ids_raw = result.get("persona_ids")
        if persona_ids_raw and isinstance(persona_ids_raw, (list, tuple)):
            persona_ids = [str(pid) for pid in persona_ids_raw if pid]

        # Parse document_ids from array (linked documents)
        document_ids: list[str] = []
        document_ids_raw = result.get("document_ids")
        if document_ids_raw and isinstance(document_ids_raw, (list, tuple)):
            document_ids = [str(did) for did in document_ids_raw if did]

        # Get can_edit from SQL (handles default objects and role checks)
        can_edit = result.get("can_edit", False)

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
            persona_ids=persona_ids,
            persona_mapping=persona_mapping,
            valid_persona_ids=valid_persona_ids,
            document_ids=document_ids,
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
            operation="get_parameter_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
