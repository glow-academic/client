# app/routes/attempt.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Attempts, Templates, Chats, Profiles, ChatTemplates, Classes, Scenarios
from app.db import get_session
from sqlmodel import Session, select
import logging
from app.agents.scenario import run_scenario_agent
from typing import List, Optional
import random

from app.agents.evaluate import run_evaluate_agent
from app.agents.generic import run_generic_agent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator, Optional

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_attempt(
    template_id: str = Form(...),
    user_id: Optional[str] = Form(None), 
    class_id: str = Form(...),
    test_data: Optional[bool] = Form(False),
    session: Session = Depends(get_session),
):
    """
    This endpoint creates a new attempt and associated chats based on a template.
    For guest mode, user_id can be None or empty string.
    Handles both permanent individual practice templates and dynamic quiz templates.
    """
    try:
        # Get the template
        template = session.exec(select(Templates).where(Templates.id == template_id)).one_or_none()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Create the attempt
        new_attempt = Attempts(
            user_id=user_id,  # Will be None for guest mode
            class_id=class_id,
            template_id=template_id
        )
        session.add(new_attempt)
        session.commit()
        session.refresh(new_attempt)
        
        logger.info(f"Created attempt {new_attempt.id} for template {template_id}")
        
        # Get chat templates for this template and filter out invalid ones
        chat_template_ids = template.chat_template_ids or []
        
        if not chat_template_ids:
            raise HTTPException(status_code=400, detail="Template has no valid chat templates configured")
        
        # Create the first chat template
        chat_template_id = chat_template_ids[0]
        chat_template = session.exec(
            select(ChatTemplates).where(ChatTemplates.id == chat_template_id)
        ).one_or_none()
        
        if not chat_template:
            raise HTTPException(status_code=400, detail=f"Chat template {chat_template_id} not found")
        
        # Handle scenario creation or selection
        if not chat_template.scenario_id:
            scenario_id, chat_title = await run_scenario_agent(
                profile_id=chat_template.profile_id,
                user_id=user_id,  # Pass actual_user_id (can be None for guest)
                class_id=class_id,
                test_data=test_data,
                session=session
            )
        else:
            scenario_id = chat_template.scenario_id
            # Use profile-specific default titles for permanent templates
            profile = session.exec(select(Profiles).where(Profiles.id == chat_template.profile_id)).one_or_none()
            if profile:
                chat_title = f"{profile.name} Student Session"
            else:
                chat_title = "Practice Session"

        # Handle profile selection
        if not chat_template.profile_id:
            # get all profiles
            profiles = session.exec(select(Profiles)).all()
            if not profiles:
                raise HTTPException(status_code=400, detail="No profiles found")
            profile_id = random.choice(profiles).id
        else:
            profile_id = chat_template.profile_id

        # Create the chat with the scenario and link it to this attempt
        chat = Chats(
            title=chat_title,
            scenario_id=scenario_id,
            profile_id=profile_id,
            chat_template_id=chat_template_id,
            attempt_id=new_attempt.id,
            completed=False
        )

        session.add(chat)
        session.commit()
        session.refresh(chat)
        
        return {
            "success": True,
            "message": "Attempt started successfully",
            "attempt_id": str(new_attempt.id),
            "chat_id": str(chat.id)
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error starting attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start attempt: {str(e)}")

@router.post("/message")
async def message(
    chat_id: str = Form(...),
    message: str = Form(...),
    test_data: Optional[bool] = Form(False),
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

        async def event_stream() -> AsyncIterator[str]:
            # initial heartbeat so proxies flush headers
            yield ":\n\n"

            try:
                async for token in run_generic_agent(
                    chat_id=chat_id, input_text=message, session=session, test_data=test_data
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



@router.post("/continue")
async def continue_attempt(
    attempt_id: str = Form(...),
    chat_id: str = Form(...),
    test_data: Optional[bool] = Form(False),
    session: Session = Depends(get_session),
):
    """
    This endpoint is used to continue an attempt, which should be called when a chat is ended.
    """
    try:
        # get the chat
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Get the attempt
        attempt = session.exec(select(Attempts).where(Attempts.id == attempt_id)).one_or_none()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")
        
        # get the template  
        template = session.exec(select(Templates).where(Templates.id == attempt.template_id)).one_or_none()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # get all the chat templates for this template and filter out invalid ones
        chat_template_ids = template.chat_template_ids or []
        
        # Find the current chat template index and get the next one
        current_chat_template_id = chat.chat_template_id
        if current_chat_template_id not in chat_template_ids:
            raise HTTPException(status_code=400, detail="Current chat template not found in template")
        
        current_index = chat_template_ids.index(current_chat_template_id)
        next_index = current_index + 1
        
        # do not continue if we do not have any chat templates left
        next_chat_id = chat_id
        if next_index < len(chat_template_ids):
            next_chat_template_id = chat_template_ids[next_index]
            next_chat_template = session.exec(select(ChatTemplates).where(ChatTemplates.id == next_chat_template_id)).one_or_none()
            if not next_chat_template:
                raise HTTPException(status_code=404, detail="Next chat template not found")
            
            # if no scenario_id, create a new one
            if not next_chat_template.scenario_id:
                scenario_id, chat_title = await run_scenario_agent(
                    profile_id=next_chat_template.profile_id,
                    user_id=attempt.user_id, 
                    class_id=attempt.class_id,
                    test_data=test_data,
                    session=session
                )
            else:
                scenario_id = next_chat_template.scenario_id
                chat_title = next_chat_template.title

            # if no profile_id, select a random profile
            if not next_chat_template.profile_id:
                # get all profiles
                profiles = session.exec(select(Profiles)).all()
                if not profiles:
                    raise HTTPException(status_code=400, detail="No profiles found for class")
                profile_id = random.choice(profiles).id
            else:
                profile_id = next_chat_template.profile_id

            # Create the chat with the scenario and link it to this attempt
            next_chat = Chats(
                title=chat_title,
                scenario_id=scenario_id,
                profile_id=profile_id,
                chat_template_id=next_chat_template_id,  # Add the missing chat_template_id
                attempt_id=attempt_id,
                completed=False
            )
            
            # Add and commit the new chat to the database
            session.add(next_chat)
            session.commit()
            session.refresh(next_chat)
            next_chat_id = next_chat.id

        # Run logic to end the current chat
        rubric_id = await run_evaluate_agent(chat_id, test_data, session)
        
        return {
            "success": True,
            "message": "Chat ended successfully",
            "chat_id": str(next_chat_id),
            "rubric_id": rubric_id,
            "completed": next_chat_id == chat_id
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error continuing attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to continue attempt: {str(e)}")