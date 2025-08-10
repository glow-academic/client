# app/routes/scenarios.py
import logging
import uuid
from typing import List

from app.db import get_session
from app.services.agents.collection.scenario import run_scenario_agent
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session

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
        title, description, _ = await run_scenario_agent(
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