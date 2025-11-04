"""Scenario create endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class CreateScenarioRequest(BaseModel):
    """Request to create a scenario."""

    name: str
    problem_statement: str
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
    copy_paste_allowed: bool = False
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateScenarioResponse:
    """Create a new scenario."""
    tags = ["scenarios"]  # From router tags
    try:
        async with transaction(conn):
            # Insert scenario
            create_sql = load_sql("sql/v3/scenarios/create_scenario.sql")
            result = await conn.fetchrow(
                create_sql,
                request.name,
                request.active,
                request.hints_enabled,
                request.objectives_enabled,
                request.image_input_enabled,
                request.copy_paste_allowed,
                request.input_guardrail_enabled,
                request.output_guardrail_enabled,
            )

            if not result:
                raise ValueError("Failed to create scenario")

            scenario_id = str(result["id"])

            # Insert department links if department_ids provided
            if request.department_ids:
                dept_sql = load_sql("sql/v3/scenarios/create_scenario_departments.sql")
                await conn.execute(dept_sql, scenario_id, request.department_ids)

            # Insert self-referencing edge in scenario_tree
            tree_sql = load_sql("sql/v3/scenarios/insert_scenario_tree_edge.sql")
            await conn.execute(tree_sql, scenario_id, scenario_id, True)

            # Insert problem statement versions or single problem statement
            if request.problem_statement_versions and len(request.problem_statement_versions) > 0:
                versions_list = [v for v in request.problem_statement_versions if v and v.strip()]
                ps_sql = load_sql("sql/v3/scenarios/insert_scenario_problem_statement.sql")
                for idx, version_text in enumerate(versions_list):
                    await conn.execute(
                        ps_sql,
                        scenario_id,
                        version_text.strip(),
                        idx == len(versions_list) - 1,  # Last version is active
                    )
            elif request.problem_statement:
                ps_sql = load_sql("sql/v3/scenarios/insert_scenario_problem_statement.sql")
                await conn.execute(ps_sql, scenario_id, request.problem_statement, True)

            # Insert persona relationships
            if request.persona_ids:
                persona_sql = load_sql("sql/v3/scenarios/insert_scenario_persona.sql")
                for persona_id in request.persona_ids:
                    await conn.execute(persona_sql, scenario_id, persona_id)

            # Insert document relationships
            doc_sql = load_sql("sql/v3/scenarios/insert_scenario_document.sql")
            for document_id in request.document_ids:
                await conn.execute(doc_sql, scenario_id, document_id)

            # Insert objectives
            obj_sql = load_sql("sql/v3/scenarios/insert_scenario_objective.sql")
            for idx, obj_id in enumerate(request.objective_ids):
                # Skip composite IDs (references to existing objectives)
                if "_" in obj_id and len(obj_id.split("_")) == 2:
                    continue
                # New objective text
                await conn.execute(obj_sql, scenario_id, idx, obj_id)

            # Insert parameter relationships
            param_sql = load_sql("sql/v3/scenarios/insert_scenario_parameter.sql")
            for parameter_id, parameter_item_ids in request.parameters.items():
                for param_item_id in parameter_item_ids:
                    await conn.execute(param_sql, scenario_id, param_item_id)

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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

