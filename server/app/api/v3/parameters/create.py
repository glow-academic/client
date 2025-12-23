"""Parameter create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


# Inline request/response schemas
class FieldConnectionCreate(BaseModel):
    """Field connection creation schema."""

    field_id: str
    default: bool = False  # Exactly one field connection per parameter must be default
    active: bool = True


class CreateParameterRequest(BaseModel):
    """Request to create parameter with field connections."""

    name: str
    description: str
    active: bool
    simulation_parameter: bool = False
    document_parameter: bool = False
    persona_parameter: bool = False
    scenario_parameter: bool = False
    video_parameter: bool = False
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    field_connections: list[FieldConnectionCreate]
    # profileId removed - comes from X-Profile-Id header


class CreateParameterResponse(BaseModel):
    """Response from create parameter."""

    success: bool
    parameterId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateParameterResponse,
    dependencies=[
        audit_activity(
            "parameter.created",
            "{{ actor.name }} created parameter '{{ parameter.name }}'",
        )
    ],
)
async def create_parameter(
    request: CreateParameterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateParameterResponse:
    """Create a new parameter with nested items."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation

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

        async with transaction(conn):
            # Prepare field connections as JSONB array
            import json

            field_connections_data = []
            for conn in request.field_connections:
                conn_dict = {
                    "field_id": conn.field_id,
                    "default": conn.default,
                    "active": conn.active,
                }
                field_connections_data.append(conn_dict)

            field_connections_json = json.dumps(field_connections_data)

            # Create parameter with field connections and department links in single SQL (DHH style)
            sql_query = load_sql("app/sql/v3/parameters/create_parameter_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.active,
                request.simulation_parameter,
                request.document_parameter,
                request.persona_parameter,
                request.scenario_parameter,
                request.video_parameter,
                request.department_ids,  # Parameter-level department_ids
                field_connections_json,  # JSONB array of field connections
                profile_id,
            )
            parameter_result = await conn.fetchrow(sql_query, *sql_params)

            if not parameter_result:
                raise ValueError("Failed to create parameter")

            parameter_id = parameter_result["parameter_id"]
            actor_name = parameter_result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    parameter={"name": request.name, "id": parameter_id},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateParameterResponse(
            success=True,
            parameterId=parameter_id,
            message=f"Parameter '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
