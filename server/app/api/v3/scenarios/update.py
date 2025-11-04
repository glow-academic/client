"""Scenario update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateScenarioResponse:
    """Update an existing scenario."""
    try:
        async with transaction(conn):
            # Check if scenario exists
            name_sql = load_sql("sql/v3/scenarios/get_scenario_name.sql")
            existing = await conn.fetchrow(name_sql, request.scenarioId)

            if not existing:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Update scenario basic fields
            update_sql = load_sql("sql/v3/scenarios/update_scenario.sql")
            await conn.execute(
                update_sql,
                request.name,
                request.active,
                request.hints_enabled,
                request.objectives_enabled,
                request.image_input_enabled,
                request.copy_paste_allowed,
                request.input_guardrail_enabled,
                request.output_guardrail_enabled,
                request.scenarioId,
            )

            # Update problem statement (always create new version, deactivate old)
            if request.problem_statement:
                deactivate_sql = load_sql("sql/v3/scenarios/deactivate_scenario_problem_statements.sql")
                await conn.execute(deactivate_sql, request.scenarioId)

                create_ps_sql = load_sql("sql/v3/scenarios/create_scenario_problem_statement.sql")
                await conn.fetchval(create_ps_sql, request.scenarioId, request.problem_statement)

            # Update scenario-department links (DELETE + INSERT pattern)
            delete_dept_sql = load_sql("sql/v3/scenarios/delete_scenario_departments.sql")
            await conn.execute(delete_dept_sql, request.scenarioId)

            if request.department_ids:
                create_dept_sql = load_sql("sql/v3/scenarios/create_scenario_departments.sql")
                await conn.execute(create_dept_sql, request.scenarioId, request.department_ids)

            # Update personas (delete old, insert new)
            delete_persona_sql = load_sql("sql/v3/scenarios/delete_scenario_personas.sql")
            await conn.execute(delete_persona_sql, request.scenarioId)

            if request.persona_ids:
                persona_sql = load_sql("sql/v3/scenarios/insert_scenario_persona.sql")
                for persona_id in request.persona_ids:
                    await conn.execute(persona_sql, request.scenarioId, persona_id)

            # Update documents
            delete_doc_sql = load_sql("sql/v3/scenarios/delete_scenario_documents.sql")
            await conn.execute(delete_doc_sql, request.scenarioId)

            doc_sql = load_sql("sql/v3/scenarios/insert_scenario_document.sql")
            for document_id in request.document_ids:
                await conn.execute(doc_sql, request.scenarioId, document_id)

            # Update objectives
            delete_obj_sql = load_sql("sql/v3/scenarios/delete_scenario_objectives.sql")
            await conn.execute(delete_obj_sql, request.scenarioId)

            obj_sql = load_sql("sql/v3/scenarios/insert_scenario_objective.sql")
            for idx, obj_id in enumerate(request.objective_ids):
                if "_" in obj_id and len(obj_id.split("_")) == 2:
                    # Skip existing composite IDs
                    continue
                # New objective
                await conn.execute(obj_sql, request.scenarioId, idx, obj_id)

            # Update parameters
            delete_param_sql = load_sql("sql/v3/scenarios/delete_scenario_parameters.sql")
            await conn.execute(delete_param_sql, request.scenarioId)

            param_sql = load_sql("sql/v3/scenarios/insert_scenario_parameter.sql")
            for parameter_id, parameter_item_ids in request.parameters.items():
                for param_item_id in parameter_item_ids:
                    await conn.execute(param_sql, request.scenarioId, param_item_id)

            result_data = UpdateScenarioResponse(
                success=True,
                message=f"Scenario '{request.name}' updated successfully",
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
        raise HTTPException(status_code=500, detail=str(e))

