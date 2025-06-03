# app/routes/attempt.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Attempts, Templates, Chats, Profiles, ChatTemplates, Classes
from app.db import get_session
from sqlmodel import Session, select
import logging
from app.agents.scenario import run_scenario_agent
from typing import List, Optional
import random

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_attempt(
    template_id: str = Form(...),
    user_id: Optional[str] = Form(None),  # Optional for guest mode
    class_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    This endpoint creates a new attempt and associated chats based on a template.
    For guest mode, user_id can be None.
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
        
        # Get chat templates for this template
        chat_template_ids = template.chat_template_ids
        if not chat_template_ids:
            raise HTTPException(status_code=400, detail="Template has no chat templates configured")
        
        # Create chats for each chat template
        chat_ids = []
        for chat_template_id in chat_template_ids:
            # Get the chat template to find the profile
            chat_template = session.exec(
                select(ChatTemplates).where(ChatTemplates.id == chat_template_id)
            ).one_or_none()
            
            if not chat_template:
                logger.warning(f"Chat template {chat_template_id} not found, skipping")
                continue
            
            # Create a scenario using the scenario agent
            scenario_id, chat_title = await run_scenario_agent(
                profile_id=chat_template.profile_id,
                user_id=user_id,  # Pass user_id (can be None for guest)
                class_id=class_id,
                session=session
            )
            
            # Create the chat with the scenario and link it to this attempt
            chat = Chats(
                title=chat_title,
                scenario_id=scenario_id,
                attempt_id=new_attempt.id,
                profile_id=chat_template.profile_id,  # Add profile_id from chat template
                completed=False
            )
            session.add(chat)
            session.commit()
            session.refresh(chat)
            
            chat_ids.append(str(chat.id))
            logger.info(f"Created chat {chat.id} for attempt {new_attempt.id}")
        
        logger.info(f"Started attempt {new_attempt.id} with {len(chat_ids)} chats: {chat_ids}")
        
        return {
            "success": True,
            "message": "Attempt started successfully",
            "attempt_id": str(new_attempt.id),
            "chat_ids": chat_ids,
            "total_chats": len(chat_ids)
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error starting attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start attempt: {str(e)}")


@router.get("/{attempt_id}")
async def get_attempt(
    attempt_id: str,
    session: Session = Depends(get_session),
):
    """
    Get attempt details with associated template and class information.
    """
    try:
        # Get the attempt with joined data
        query = (
            select(Attempts, Templates, Classes)
            .join(Templates, Attempts.template_id == Templates.id)
            .join(Classes, Attempts.class_id == Classes.id)
            .where(Attempts.id == attempt_id)
        )
        
        result = session.exec(query).one_or_none()
        if not result:
            raise HTTPException(status_code=404, detail="Attempt not found")
        
        attempt, template, class_info = result
        
        return {
            "success": True,
            "attempt": {
                "id": str(attempt.id),
                "created_at": attempt.created_at.isoformat(),
                "user_id": str(attempt.user_id) if attempt.user_id else None,
                "class_id": str(attempt.class_id),
                "template_id": str(attempt.template_id),
                "template_title": template.title,
                "template_time_limit": template.time_limit,
                "class_name": class_info.name,
                "class_code": class_info.class_code,
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting attempt {attempt_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get attempt: {str(e)}")


@router.get("/{attempt_id}/chats")
async def get_attempt_chats(
    attempt_id: str,
    session: Session = Depends(get_session),
):
    """
    Get all chats associated with an attempt.
    """
    try:
        # Verify attempt exists
        attempt = session.exec(select(Attempts).where(Attempts.id == attempt_id)).one_or_none()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")
        
        # Get chats for this attempt
        chats = session.exec(select(Chats).where(Chats.attempt_id == attempt_id)).all()
        
        chat_data = []
        for chat in chats:
            chat_data.append({
                "id": str(chat.id),
                "title": chat.title,
                "created_at": chat.created_at.isoformat(),
                "completed": chat.completed,
                "completed_at": chat.completed_at.isoformat() if chat.completed_at else None,
                "scenario_id": str(chat.scenario_id),
                "attempt_id": str(chat.attempt_id),
            })
        
        return {
            "success": True,
            "chats": chat_data,
            "total_chats": len(chat_data)
        }
        
    except Exception as e:
        logger.error(f"Error getting chats for attempt {attempt_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get attempt chats: {str(e)}")