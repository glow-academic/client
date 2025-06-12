# app/routes/scenarios.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.db import get_session
from sqlmodel import Session
import logging
from app.services.agents.scenario import run_scenario_agent
from app.services.agents.generic import run_generic_agent_bare
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator, List

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/new")
async def new_scenario(
    agent_id: str | None = Form(None),
    class_id: str | None = Form(None),
    document_ids: List[str] | None = Form(None),
    seniority: str | None = Form(None),
    crowdedness: int | None = Form(None),
    intensity: int | None = Form(None),
    session: Session = Depends(get_session),
):
    """
    This endpoint creates a new scenario using AI generation.
    """
    try:
        # Convert empty strings to None for better handling
        agent_id = agent_id if agent_id and agent_id.strip() else None
        class_id = class_id if class_id and class_id.strip() else None
        seniority = seniority if seniority and seniority.strip() else None

        # Filter out empty document IDs
        if document_ids:
            document_ids = [
                doc_id for doc_id in document_ids if doc_id and doc_id.strip()
            ]
            if not document_ids:
                document_ids = None

        # Run the scenario agent to generate title and description
        title, description = await run_scenario_agent(
            agent_id=agent_id,
            class_id=class_id,
            document_ids=document_ids,
            seniority=seniority,
            crowdedness=crowdedness,
            intensity=intensity,
            session=session,
        )

        return {
            "success": True,
            "message": "Scenario generated successfully",
            "title": title,
            "description": description,
        }

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
    agent_id: str = Form(...),
    description: str = Form(""),
    query: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Streams assistant tokens back to the frontend via Server-Sent Events for testing a scenario.
    """
    try:
        # Validate required fields
        if not agent_id or not agent_id.strip():
            raise HTTPException(status_code=400, detail="Agent ID is required")

        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Query is required")

        async def event_stream() -> AsyncIterator[str]:
            # Initial heartbeat so proxies flush headers
            yield ":\n\n"

            try:
                # Create input items with scenario context and user query
                input_items = []

                # Only add scenario description if it's provided and not empty
                if description and description.strip():
                    input_items.append(
                        {
                            "role": "assistant",
                            "content": f"The following is the scenario description for the chat: {description.strip()}",
                        }
                    )

                input_items.append(
                    {
                        "role": "user",
                        "content": query.strip(),
                    }
                )

                async for token in run_generic_agent_bare(
                    agent_id=agent_id.strip(),
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
