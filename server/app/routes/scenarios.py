# app/routes/scenarios.py
import logging
import uuid
from typing import List
from typing import List as _List

from app.db import get_session
from app.models import Scenarios
from app.services.agents.collection.scenario import run_scenario_agent
from app.utils.scenario import (randomly_fill_scenario_attributes,
                                suggest_randomized_sections)
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/new")
async def new_scenario(
    persona_id: uuid.UUID | None = Form(None),
    document_ids: List[uuid.UUID] | None = Form(None),
    parameter_item_ids: List[uuid.UUID] | None = Form(None),
    session: Session = Depends(get_session),
    profile_id: uuid.UUID | None = Form(None),
) -> JSONResponse:
    """
    This endpoint creates a new scenario using AI generation.
    """
    try:
        # Convert empty strings to None for better handling
        persona_id = persona_id if persona_id else None

        # Filter out empty document IDs
        if document_ids:
            document_ids = [doc_id for doc_id in document_ids if doc_id]
            if not document_ids:
                document_ids = None

        # Run the scenario agent to generate title and description
        title, description, objectives, _ = await run_scenario_agent(
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            group_id=None,  # no group id for scenarios
            session=session,
            profile_id=profile_id,
        )

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Scenario generated successfully",
                "title": title,
                "description": description,
                "objectives": objectives,
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error generating new scenario: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate new scenario: {str(e)}"
        )


@router.post("/practice")
async def create_practice_scenario(
    persona_id: uuid.UUID | None = Form(None),
    document_ids: List[uuid.UUID] | None = Form(None),
    parameter_item_ids: List[uuid.UUID] | None = Form(None),
    session: Session = Depends(get_session),
    profile_id: uuid.UUID | None = Form(None),
) -> JSONResponse:
    """
    Create a practice scenario by finding the base practice scenario for the persona
    and filling any missing attributes using randomly_fill_scenario_attributes.
    """
    try:
        if not persona_id:
            raise HTTPException(status_code=400, detail="persona_id is required")

        # Find the base practice scenario for this persona
        # This should be the scenario with only persona_id set, default_scenario=True, and practice_scenario=True
        base_scenario = session.exec(
            select(Scenarios).where(
                Scenarios.persona_id == persona_id,
                Scenarios.default_scenario == True,
                Scenarios.practice_scenario == True,
                # Ensure it has minimal attributes (only persona_id)
                (Scenarios.document_ids == None) | (Scenarios.document_ids == []),
                (Scenarios.parameter_item_ids == None) | (Scenarios.parameter_item_ids == [])
            )
        ).first()

        if not base_scenario:
            raise HTTPException(
                status_code=404, 
                detail=f"No base practice scenario found for persona {persona_id}"
            )

        # Use randomly_fill_scenario_attributes to fill any missing attributes
        filled_scenario = await randomly_fill_scenario_attributes(base_scenario, session)

        # Generate scenario description and name using AI if needed
        if not filled_scenario.description or filled_scenario.description.strip() == "":
            name, description, objectives, _ = await run_scenario_agent(
                persona_id=filled_scenario.persona_id,
                document_ids=filled_scenario.document_ids,
                parameter_item_ids=filled_scenario.parameter_item_ids,
                group_id=None,
                session=session,
                profile_id=profile_id,
            )
            filled_scenario.name = name
            filled_scenario.description = description
            filled_scenario.objectives = objectives

        # Update the base scenario in the database
        session.add(filled_scenario)
        session.commit()
        session.refresh(filled_scenario)

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Practice scenario created successfully",
                "scenario": {
                    "id": str(filled_scenario.id),
                    "name": filled_scenario.name,
                    "description": filled_scenario.description,
                    "objectives": filled_scenario.objectives,
                    "personaId": str(filled_scenario.persona_id) if filled_scenario.persona_id else None,
                    "documentIds": [str(doc_id) for doc_id in (filled_scenario.document_ids or [])],
                    "parameterItemIds": [str(param_id) for param_id in (filled_scenario.parameter_item_ids or [])],
                }
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating practice scenario: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create practice scenario: {str(e)}"
        )


@router.post("/randomize")
async def randomize_scenario(
    # Optional current inputs and scenario text
    name: str | None = Form(None),
    description: str | None = Form(None),
    persona_id: uuid.UUID | None = Form(None),
    document_ids: _List[uuid.UUID] | None = Form(None),
    parameter_item_ids: _List[uuid.UUID] | None = Form(None),
    # Which sections to randomize: any of ["persona", "documents", "parameters"]
    targets: _List[str] | None = Form(None),
    session: Session = Depends(get_session),
) -> JSONResponse:
    try:
        # Normalize empty lists
        if document_ids:
            document_ids = [d for d in document_ids if d]
        if parameter_item_ids:
            parameter_item_ids = [p for p in parameter_item_ids if p]
        if targets:
            targets = [t for t in targets if (t or "").strip()]

        suggestions = suggest_randomized_sections(
            name=name,
            description=description,
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            targets=targets or [],
            session=session,
        )

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Randomization suggestions generated",
                "personaId": str(suggestions["persona_id"]) if suggestions.get("persona_id") else None,
                "documentIds": [str(x) for x in (suggestions.get("document_ids") or [])],
                "parameterItemIds": [str(x) for x in (suggestions.get("parameter_item_ids") or [])],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error randomizing scenario: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to randomize scenario: {str(e)}")