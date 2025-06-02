# app/routes/chat.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Chats, Profiles  # Added Profiles
from app.db import get_session
from sqlmodel import Session, select  # Import Session
import logging  # Import logging
from app.agents.evaluate import run_evaluate_agent
from app.agents.aggressive import run_aggressive_agent
from app.agents.confused import run_confused_agent
from app.agents.happy import run_happy_agent
from app.agents.scenario import run_scenario_agent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator

logger = logging.getLogger(__name__)  # Initialize logger

router = APIRouter()

AGENT_DISPATCH = {
    "aggressive": run_aggressive_agent,
    "confused": run_confused_agent,
    "happy": run_happy_agent,
}


@router.post("/new")
async def new_chat(
    profile_id: str = Form(...),
    class_id: str = Form(...),
    user_id: str = Form(...),
    session: Session = Depends(get_session),
):  # Added session dependency
    """
    This endpoint is used to create a new chat.
    """
    chat_id = await run_scenario_agent(profile_id, user_id, class_id, session)
    return {"message": "Chat started", "chat_id": chat_id}


@router.post("/end")
async def end_chat(
    chat_id: str = Form(...), session: Session = Depends(get_session)
):  # Added session dependency
    """
    This endpoint is used to end a chat.
    """
    rubric_id = await run_evaluate_agent(chat_id, session)
    return {"message": "Chat ended", "rubric_id": rubric_id}


@router.post("/message")
async def message(
    chat_id: str = Form(...),
    message: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Streams assistant tokens back to the frontend via Server-Sent Events.
    """
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Get the profile to determine which agent to use
    profile = session.exec(select(Profiles).where(Profiles.id == chat.profile_id)).one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    agent_factory = AGENT_DISPATCH.get(profile.name.lower())
    if not agent_factory:
        raise HTTPException(status_code=400, detail=f"Invalid profile: {profile.name}")

    async def event_stream() -> AsyncIterator[str]:
        # initial heartbeat so proxies flush headers
        yield ":\n\n"

        try:
            async for token in agent_factory(
                chat_id=chat_id, input_text=message, session=session
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
