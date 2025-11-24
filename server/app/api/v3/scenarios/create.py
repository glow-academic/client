"""Scenario create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateScenarioRequest(BaseModel):
    """Request to create a scenario."""

    name: str
    problem_statement: str
    problem_statement_name: str | None = None  # Optional, defaults to scenario name
    problem_statement_versions: list[str] | None = None
    department_ids: list[str] | None
    active: bool
    persona_ids: list[str] | None
    document_ids: list[str]
    objective_ids: list[str]
    parameters: dict[str, list[str]]
    hints_enabled: bool = False
    objectives_enabled: bool = True
    image_input_enabled: bool = False
    input_guardrail_enabled: bool = False
    output_guardrail_enabled: bool = False


class CreateScenarioResponse(BaseModel):
    """Response from create operation."""

    success: bool
    scenarioId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateScenarioResponse)
async def create_scenario(
    request: CreateScenarioRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateScenarioResponse:
    """Create a new scenario."""
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

        # Prepare problem statement versions
        # If versions provided, ensure problem_statement is included and will be marked active
        problem_statement_versions = None
        if (
            request.problem_statement_versions
            and len(request.problem_statement_versions) > 0
        ):
            # Clean and include all versions
            versions_list = [
                v.strip() for v in request.problem_statement_versions if v and v.strip()
            ]
            # Ensure problem_statement is in the list (it will be marked active in SQL)
            if (
                request.problem_statement
                and request.problem_statement.strip() not in versions_list
            ):
                versions_list.append(request.problem_statement.strip())
            problem_statement_versions = versions_list if versions_list else None

        # Ensure arrays are not None (use empty arrays)
        department_ids = request.department_ids or []
        persona_ids = request.persona_ids or []
        document_ids = request.document_ids or []
        objective_ids = filtered_objective_ids or []
        parameter_item_ids = parameter_item_ids or []

        # Create scenario with all relationships in a single SQL file
        sql_query = load_sql("sql/v3/scenarios/create_scenario_complete.sql")
        sql_params = (
            request.name,
            request.active,
            request.hints_enabled,
            request.objectives_enabled,
            request.image_input_enabled,
            request.input_guardrail_enabled,
            request.output_guardrail_enabled,
            request.problem_statement,
            request.problem_statement_name,  # Optional problem statement name
            problem_statement_versions,
            department_ids if department_ids else None,
            persona_ids if persona_ids else None,
            document_ids,
            objective_ids,
            parameter_item_ids,
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise ValueError("Failed to create scenario")

        scenario_id = result["scenario_id"]

        result_data = CreateScenarioResponse(
            success=True,
            scenarioId=scenario_id,
            message=f"Scenario '{request.name}' created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
