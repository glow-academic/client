# app/routes/quiz.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Quizzes, Chats, Profiles
from app.db import get_session
from sqlmodel import Session, select
import logging
from app.agents.scenario import run_scenario_agent
from typing import List

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_quiz(
    quiz_id: str = Form(...),
    user_id: str = Form(...),
    class_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    This endpoint is used to start a quiz by creating multiple chats based on the quiz's template configuration.
    """
    # Get the quiz
    quiz = session.exec(select(Quizzes).where(Quizzes.id == quiz_id)).one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get all profiles to use for creating chats
    profiles = session.exec(select(Profiles)).all()
    if not profiles:
        raise HTTPException(status_code=400, detail="No profiles found")
    
    # Create chats based on the quiz's template_ids
    chat_ids = []
    
    for template_id in quiz.template_ids:
        # For each template, we need to determine which profile to use
        # For now, we'll randomly select from available profiles
        # In a more sophisticated implementation, you might map template_ids to specific profiles
        import random
        selected_profile = random.choice(profiles)
        
        # Create a chat using the scenario agent
        chat_id = await run_scenario_agent(
            profile_id=selected_profile.id, 
            user_id=user_id, 
            class_id=class_id, 
            session=session
        )
        
        # Update the chat to link it to this quiz
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()
        chat.quiz_id = quiz_id
        session.add(chat)
        
        chat_ids.append(chat_id)
    
    session.commit()
    
    logger.info(f"Started quiz {quiz_id} with {len(chat_ids)} chats: {chat_ids}")
    
    return {
        "message": "Quiz started", 
        "quiz_id": quiz_id,
        "chat_ids": chat_ids,
        "total_chats": len(chat_ids)
    } 