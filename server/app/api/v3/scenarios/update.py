"""Scenario update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class UpdateScenarioRequest(BaseModel):
    """Request to update a scenario."""

    scenarioId: str
    name: str
    problem_statement: str
    department_ids: list[str] | None
    active: bool
    persona_ids: list[str] | None
    document_ids: list[str]
    objective_ids: list[str]
    parameters: dict[str, list[str]]
    hints_enabled: bool = False
    objectives_enabled: bool = True
    image_input_enabled: bool = False
    copy_paste_allowed: bool = False
    input_guardrail_enabled: bool = False
    output_guardrail_enabled: bool = False


class UpdateScenarioResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateScenarioResponse)
async def update_scenario(
    request: UpdateScenarioRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateScenarioResponse:
    """Update an existing scenario."""
    tags = ["scenarios"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Prepare data for consolidated SQL
        # Filter out composite objective IDs (references to existing objectives)
        filtered_objective_ids = [
            obj_id
            for obj_id in request.objective_ids
            if not ("_" in obj_id and len(obj_id.split("_")) == 2)
        ]

        # Flatten parameters dict into array of parameter_item_ids
        parameter_item_ids = [
            param_item_id
            for param_item_ids in request.parameters.values()
            for param_item_id in param_item_ids
        ]

        # Ensure arrays are not None (use empty arrays)
        department_ids = request.department_ids or []
        persona_ids = request.persona_ids or []
        document_ids = request.document_ids or []
        objective_ids = filtered_objective_ids or []
        parameter_item_ids = parameter_item_ids or []

        # Update scenario with all relationships in a single SQL file
        sql_query = load_sql("sql/v3/scenarios/update_scenario_complete.sql")
        sql_params = (
            request.scenarioId,
            request.name,
            request.active,
            request.hints_enabled,
            request.objectives_enabled,
            request.image_input_enabled,
            request.copy_paste_allowed,
            request.input_guardrail_enabled,
            request.output_guardrail_enabled,
            request.problem_statement,
            department_ids if department_ids else None,
            persona_ids if persona_ids else None,
            document_ids,
            objective_ids,
            parameter_item_ids,
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Scenario not found: {request.scenarioId}"
            )

        result_data = UpdateScenarioResponse(
            success=True,
            message=f"Scenario '{result['name']}' updated successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
