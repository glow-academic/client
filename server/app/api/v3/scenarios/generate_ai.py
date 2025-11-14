"""Scenario generate AI endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.agents.collection.scenario import run_scenario_agent
from app.db import get_db
from app.utils.error_handler import handle_route_error

# Inline request/response schemas
class GenerateScenarioAIRequest(BaseModel):
    """Request to generate AI scenario content."""

    departmentId: str
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    profileId: str | None = None
    userInstructions: str | None = None
    objectivesEnabled: bool = True


class GenerateScenarioAIResponse(BaseModel):
    """Response from AI scenario generation."""

    success: bool
    message: str
    title: str
    description: str
    objectives: list[str]


router = APIRouter()


@router.post("/generate-ai", response_model=GenerateScenarioAIResponse)
async def generate_scenario_ai(
    request: GenerateScenarioAIRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateScenarioAIResponse:
    """Generate AI scenario content (title, description, objectives)."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        persona_ids = (
            [uuid.UUID(p) for p in request.personaIds] if request.personaIds else None
        )
        # For AI agent, use first persona if multiple provided (agent expects single persona_id)
        persona_id = persona_ids[0] if persona_ids and len(persona_ids) > 0 else None
        document_ids = (
            [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in request.parameterItemIds]
            if request.parameterItemIds
            else None
        )
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        # Run the scenario agent
        title, description, objectives, _ = await run_scenario_agent(
            department_id=department_id,
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            group_id=None,
            conn=conn,
            profile_id=profile_id,
            user_instructions=request.userInstructions,
            objectives_enabled=request.objectivesEnabled,
        )

        # Limit objectives to maximum 3
        limited_objectives = objectives[:3] if objectives else []

        return GenerateScenarioAIResponse(
            success=True,
            message="Scenario generated successfully",
            title=title,
            description=description,
            objectives=limited_objectives,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_scenario_ai",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

