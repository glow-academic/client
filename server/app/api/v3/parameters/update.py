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
class ParameterItemCreate(BaseModel):
    """Parameter item creation schema."""

    name: str
    description: str
    value: str
    department_ids: list[str] | None = None  # Optional for backward compatibility


class UpdateParameterRequest(BaseModel):
    """Request to update parameter with nested items."""

    parameterId: str
    name: str
    description: str
    numerical: bool
    active: bool
    document_parameter: bool
    practice_parameter: bool
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_items: list[ParameterItemCreate]
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

            # Prepare items as JSONB array
            import json

            items_data = []
            for item in request.parameter_items:
                item_dict = {
                    "name": item.name,
                    "description": item.description,
                    "value": item.value,
                }
                # Only include department_ids if it's not None
                if item.department_ids is not None:
                    item_dict["department_ids"] = item.department_ids  # type: ignore
                items_data.append(item_dict)

            items_json = json.dumps(items_data)

            # Update parameter with items and department links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/parameters/update_parameter_complete.sql")
            sql_params = (
                request.parameterId,
                request.name,
                request.description,
                request.numerical,
                request.active,
                request.document_parameter,
                request.practice_parameter,
                request.department_ids,  # Parameter-level department_ids (fallback)
                items_json,  # JSONB array of items
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
