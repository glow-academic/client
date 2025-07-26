# app/routes/scenarios.py
import json
import logging
import uuid
from typing import AsyncIterator, List

from agents.items import TResponseInputItem
from app.db import get_session
from app.services.agents.collection.scenario import run_scenario_agent
from app.services.agents.generic import run_generic_agent
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/new")
async def new_scenario(
    persona_id: uuid.UUID | None = Form(None),
    class_id: uuid.UUID | None = Form(None),
    document_ids: List[uuid.UUID] | None = Form(None),
    parameter_item_ids: List[uuid.UUID] | None = Form(None),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    This endpoint creates a new scenario using AI generation.
    """
    try:
        # Convert empty strings to None for better handling
        persona_id = persona_id if persona_id else None
        class_id = class_id if class_id else None
        seniority = seniority if seniority else None
        location_id = location_id if location_id else None
        time_id = time_id if time_id else None
        deadline_id = deadline_id if deadline_id else None

        # Filter out empty document IDs
        if document_ids:
            document_ids = [doc_id for doc_id in document_ids if doc_id]
            if not document_ids:
                document_ids = None

        # Run the scenario agent to generate title and description
        title, description, _ = await run_scenario_agent(
            persona_id=persona_id,
            class_id=class_id,
            document_ids=document_ids,
            crowdedness=crowdedness,
            intensity=intensity,
            location_id=location_id,
            time_id=time_id,
            deadline_id=deadline_id,
            group_id=None,  # no group id for scenarios
            session=session,
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


@router.post("/test")
async def test_scenario(
    persona_id: uuid.UUID = Form(...),
    description: str = Form(""),
    query: str = Form(...),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """
    Streams assistant tokens back to the frontend via Server-Sent Events for testing a scenario.
    """
    try:
        # Validate required fields
        if not persona_id:
            raise HTTPException(status_code=400, detail="Persona ID is required")

        if not query:
            raise HTTPException(status_code=400, detail="Query is required")

        async def event_stream() -> AsyncIterator[str]:
            # Initial heartbeat so proxies flush headers
            yield ":\n\n"

            try:
                # Create input items with scenario context and user query
                input_items: list[TResponseInputItem] = []

                # Only add scenario description if it's provided and not empty
                if description:
                    input_items.append(
                        {
                            "role": "user",
                            "content": f"The following is the scenario description for the chat: {description}",
                        }
                    )

                input_items.append(
                    {
                        "role": "user",
                        "content": query,
                    }
                )

                async for token in run_generic_agent(
                    persona_id=persona_id,
                    input_items=input_items,
                    session=session,
                ):
                    yield f"data: {json.dumps({'text': token})}\n\n"

                yield 'data: {"done": true}\n\n'
            except Exception as exc:
                err_msg = str(exc)
                logger.exception("Streaming error: %s", err_msg)
                yield f"data: {json.dumps({'error': err_msg})}\n\n"
                raise

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error in test scenario endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process test query: {str(e)}"
        )
