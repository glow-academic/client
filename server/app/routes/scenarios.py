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
    agent_id: str = Form(...),
    class_id: str = Form(...),
    document_ids: List[str] = Form(...),
    seniority: str = Form(...),
    crowdedness: str = Form(...),
    intensity: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    This endpoint creates a new scenario.
    """
    try:
        # run the scenario agent
        title, description = await run_scenario_agent(
            agent_id=agent_id,
            class_id=class_id,
            document_ids=document_ids,
            seniority=seniority,
            crowdedness=crowdedness,
            intensity=intensity,
        )

        return {
            "success": True,
            "message": "Scenario created successfully",
            "title": title,
            "description": description,
        }



    except HTTPException:
        # Re-raise HTTP exceptions as-is
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error creating new scenario: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create new scenario: {str(e)}"
        )


@router.post("/test")
async def test_scenario(
    agent_id: str = Form(...),
    description: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Streams assistant tokens back to the frontend via Server-Sent Events.
    """
    try:

        async def event_stream() -> AsyncIterator[str]:
            # initial heartbeat so proxies flush headers
            yield ":\n\n"

            try:
                async for token in run_generic_agent_bare(
                    agent_id=agent_id,
                    input_items=[
                        {
                            "role": "assistant",
                            "content": f"The following is the scenario description for the chat: {description}",
                        }
                    ],
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
        logger.error(f"Error in message endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process message: {str(e)}"
        )