"""Scenario duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


# Inline request/response schemas
class DuplicateScenarioRequest(BaseModel):
    """Request to duplicate a scenario."""

    scenarioId: str


class DuplicateScenarioResponse(BaseModel):
    """Response from duplicate operation."""

    success: bool
    scenarioId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateScenarioResponse)
async def duplicate_scenario(
    request: DuplicateScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateScenarioResponse:
    """Duplicate a scenario."""
    try:
        async with transaction(conn):
            # Get original scenario
            get_sql = load_sql("sql/v3/scenarios/get_scenario_for_duplicate.sql")
            original = await conn.fetchrow(get_sql, request.scenarioId)

            if not original:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Create duplicate
            insert_sql = load_sql("sql/v3/scenarios/insert_duplicate_scenario.sql")
            new_scenario = await conn.fetchrow(
                insert_sql,
                original["name"],
                original.get("hints_enabled", False),
                original.get("objectives_enabled", True),
                original.get("image_input_enabled", False),
                original.get("copy_paste_allowed", False),
                original.get("input_guardrail_enabled", False),
                original.get("output_guardrail_enabled", False),
            )

            if not new_scenario:
                raise ValueError("Failed to create duplicate scenario")

            new_scenario_id = str(new_scenario["id"])

            # Insert self-referencing edge in scenario_tree
            tree_sql = load_sql("sql/v3/scenarios/insert_scenario_tree_edge.sql")
            await conn.execute(tree_sql, new_scenario_id, new_scenario_id, True)

            # Copy problem statements
            copy_ps_sql = load_sql("sql/v3/scenarios/copy_scenario_problem_statements.sql")
            await conn.execute(copy_ps_sql, new_scenario_id, request.scenarioId)

            # Copy persona relationships
            copy_persona_sql = load_sql("sql/v3/scenarios/copy_scenario_personas.sql")
            await conn.execute(copy_persona_sql, new_scenario_id, request.scenarioId)

            # Copy document relationships
            copy_docs_sql = load_sql("sql/v3/scenarios/copy_scenario_documents.sql")
            await conn.execute(copy_docs_sql, new_scenario_id, request.scenarioId)

            # Copy objectives
            copy_obj_sql = load_sql("sql/v3/scenarios/copy_scenario_objectives.sql")
            await conn.execute(copy_obj_sql, new_scenario_id, request.scenarioId)

            # Copy parameters
            copy_params_sql = load_sql("sql/v3/scenarios/copy_scenario_parameters.sql")
            await conn.execute(copy_params_sql, new_scenario_id, request.scenarioId)

            result_data = DuplicateScenarioResponse(
                success=True,
                scenarioId=new_scenario_id,
                message=f"Scenario '{original['name']}' duplicated successfully",
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

