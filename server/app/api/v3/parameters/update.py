"""Parameter update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class FieldConnectionCreate(BaseModel):
    """Field connection creation schema."""

    field_id: str
    default: bool = False  # Exactly one field connection per parameter must be default
    active: bool = True


class UpdateParameterRequest(BaseModel):
    """Request to update parameter with field connections."""

    parameterId: str
    name: str
    description: str
    active: bool
    simulation_parameter: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool
    video_parameter: bool
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    field_connections: list[FieldConnectionCreate]
    profileId: str  # Required for auditing/access control


class UpdateParameterResponse(BaseModel):
    """Response from update parameter."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateParameterResponse)
async def update_parameter(
    request: UpdateParameterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateParameterResponse:
    """Update an existing parameter (replace all items)."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if parameter exists
            check_sql = "SELECT name FROM parameters WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.parameterId)

            if not existing:
                raise ValueError(f"Parameter not found: {request.parameterId}")

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

            # Update parameter with field connections and department links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/parameters/update_parameter_complete.sql")
            sql_params = (
                request.parameterId,
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
                request.profileId,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to update parameter")

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateParameterResponse(
            success=True, message=f"Parameter '{request.name}' updated successfully"
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
