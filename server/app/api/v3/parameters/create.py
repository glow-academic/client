"""Parameter create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ParameterItemCreate(BaseModel):
    """Parameter item creation schema."""

    name: str
    description: str
    default: bool = False  # Exactly one item per parameter must be default
    department_ids: list[str] | None = None  # Optional for backward compatibility


class CreateParameterRequest(BaseModel):
    """Request to create parameter with nested items."""

    name: str
    description: str
    active: bool
    practice_parameter: bool = False
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_items: list[ParameterItemCreate]
    persona_ids: list[str] | None = None  # Optional: link to specific personas
    document_ids: list[str] | None = None  # Optional: link to specific documents
    scenario_ids: list[str] | None = None  # Optional: link to specific scenarios
    video_ids: list[str] | None = None  # Optional: link to specific videos
    profileId: str  # Required for auditing/access control


class CreateParameterResponse(BaseModel):
    """Response from create parameter."""

    success: bool
    parameterId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateParameterResponse)
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
        async with transaction(conn):
            # Prepare items as JSONB array
            import json

            items_data = []
            for item in request.parameter_items:
                item_dict = {
                    "name": item.name,
                    "description": item.description,
                    "default": item.default,
                }
                # Only include department_ids if it's not None
                if item.department_ids is not None:
                    item_dict["department_ids"] = item.department_ids  # type: ignore
                items_data.append(item_dict)

            items_json = json.dumps(items_data)

            # Create parameter with items and department links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/parameters/create_parameter_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.active,
                request.practice_parameter,
                request.department_ids,  # Parameter-level department_ids (fallback)
                items_json,  # JSONB array of items
                request.persona_ids,  # Persona IDs for junction table
                request.document_ids,  # Document IDs for junction table
                request.scenario_ids,  # Scenario IDs for junction table
                request.video_ids,  # Video IDs for junction table
                request.profileId,
            )
            parameter_result = await conn.fetchrow(sql_query, *sql_params)

            if not parameter_result:
                raise ValueError("Failed to create parameter")

            parameter_id = parameter_result["parameter_id"]

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
