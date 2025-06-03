# app/routes/chat.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Chats, Profiles, Attempts, Scenarios  # Added Scenarios
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
from typing import AsyncIterator, Optional

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
    user_id: Optional[str] = Form(None),  # Made optional for guest mode
    attempt_id: Optional[str] = Form(None),  # Added attempt_id parameter
    session: Session = Depends(get_session),
):
    """
    This endpoint is used to create a new standalone chat.
    This is mainly for testing or individual chat creation outside of attempts.
    For production use, chats should be created through attempts.
    """
    try:
        # If attempt_id is provided, verify it exists
        if attempt_id:
            attempt = session.exec(select(Attempts).where(Attempts.id == attempt_id)).one_or_none()
            if not attempt:
                raise HTTPException(status_code=404, detail="Attempt not found")
        
        # For standalone chats, create a simple scenario or use the scenario agent
        if attempt_id:
            # If part of an attempt, use the scenario agent
            scenario_id, chat_title = await run_scenario_agent(profile_id, user_id, class_id, session)
        else:
            # For standalone chats, create a simple scenario
            scenario = Scenarios(
                name="Standalone Chat",
                description="A standalone chat session for testing or individual use"
            )
            session.add(scenario)
            session.commit()
            session.refresh(scenario)
            scenario_id = str(scenario.id)
            chat_title = "Standalone Chat Session"
        
        # Create the chat
        chat = Chats(
            title=chat_title,
            scenario_id=scenario_id,
            attempt_id=attempt_id,  # Will be None for standalone chats
            profile_id=profile_id,  # Use the provided profile_id
            completed=False
        )
        session.add(chat)
        session.commit()
        session.refresh(chat)
        
        return {
            "success": True,
            "message": "Chat started successfully",
            "chat_id": str(chat.id),
            "attempt_id": attempt_id
        }
        
    except Exception as e:
        logger.error(f"Error creating new chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat: {str(e)}")


@router.post("/end")
async def end_chat(
    chat_id: str = Form(...), 
    session: Session = Depends(get_session)
):
    """
    This endpoint is used to end a chat and generate evaluation.
    """
    try:
        # Verify chat exists
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Check if chat is already completed
        if chat.completed:
            return {
                "success": True,
                "message": "Chat already completed",
                "chat_id": chat_id,
                "already_completed": True
            }
        
        rubric_id = await run_evaluate_agent(chat_id, session)
        
        return {
            "success": True,
            "message": "Chat ended successfully",
            "chat_id": chat_id,
            "rubric_id": rubric_id
        }
        
    except Exception as e:
        logger.error(f"Error ending chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to end chat: {str(e)}")


@router.post("/message")
async def message(
    chat_id: str = Form(...),
    message: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Streams assistant tokens back to the frontend via Server-Sent Events.
    """
    try:
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Check if chat is completed
        if chat.completed:
            raise HTTPException(status_code=400, detail="Cannot send messages to completed chat")

        # Get the profile using the profile_id from the chat
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
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error in message endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process message: {str(e)}")


@router.get("/{chat_id}")
async def get_chat(
    chat_id: str,
    session: Session = Depends(get_session),
):
    """
    Get chat details including associated attempt information.
    """
    try:
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get attempt information if linked
        attempt_info = None
        if chat.attempt_id:
            attempt = session.exec(select(Attempts).where(Attempts.id == chat.attempt_id)).one_or_none()
            if attempt:
                attempt_info = {
                    "id": str(attempt.id),
                    "user_id": str(attempt.user_id) if attempt.user_id else None,
                    "class_id": str(attempt.class_id),
                    "template_id": str(attempt.template_id),
                    "created_at": attempt.created_at.isoformat()
                }
        
        return {
            "success": True,
            "chat": {
                "id": str(chat.id),
                "title": chat.title,
                "created_at": chat.created_at.isoformat(),
                "completed": chat.completed,
                "completed_at": chat.completed_at.isoformat() if chat.completed_at else None,
                "scenario_id": str(chat.scenario_id),
                "attempt_id": str(chat.attempt_id) if chat.attempt_id else None,
                "profile_id": str(chat.profile_id),
                "attempt": attempt_info
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat: {str(e)}")
