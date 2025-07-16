# student_sim_report.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import (
    Profiles,
    Scenarios,
    SimulationAttempts,
    SimulationChatFeedbacks,
    SimulationChatGrades,
    SimulationChats,
    SimulationMessages,
    Simulations,
    Standards,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def student_sim_report(profile_id: str, recent: int = 50) -> Dict[str, Any]:
    """
    Deep dive: every attempt, chat, grade, feedback
    Comprehensive student simulation report.

    Input
      • profile_id - UUID of the student profile
      • recent - Limit messages per chat (default: 50)

    Returns
      { "profile": { … }, "attempts": [ … ] }

    Quick-start
      ask:  "Full report on student X"
      call: student_sim_report("uuid-here")

    See also profile_overview() for summary view.
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        return {"error": f"Invalid profile_id format: {profile_id}"}

    session = next(get_session())
    try:
        # Get profile
        profile = session.get(Profiles, profile_uuid)
        if not profile:
            return {"error": f"Profile not found: {profile_id}"}

        profile_data = {
            "id": str(profile.id),
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "alias": profile.alias,
            "role": profile.role,
            "created_at": profile.created_at.isoformat()
            if profile.created_at
            else None,
        }

        # Get all simulation attempts for this profile
        attempts_stmt = select(SimulationAttempts).where(
            SimulationAttempts.profile_id == profile_uuid
        )
        attempts = session.exec(attempts_stmt).all()
        attempts = list(attempts)
        attempts = sorted(attempts, key=lambda x: x.created_at)

        attempts_data = []

        for attempt in attempts:
            # Get simulation details
            simulation = session.get(Simulations, attempt.simulation_id)
            if not simulation:
                continue

            # Get simulation chats for this attempt
            chats_stmt = select(SimulationChats).where(
                SimulationChats.attempt_id == attempt.id
            )
            chats = session.exec(chats_stmt).all()
            chats = list(chats)
            chats = sorted(chats, key=lambda x: x.created_at)

            for chat in chats:
                # Get scenario details
                scenario = session.get(Scenarios, chat.scenario_id)
                scenario_data = (
                    {
                        "id": str(scenario.id),
                        "name": scenario.name,
                        "description": scenario.description,
                    }
                    if scenario
                    else {}
                )

                # Get messages (limit to recent count)
                messages_stmt = select(SimulationMessages).where(
                    SimulationMessages.chat_id == chat.id
                )
                messages = session.exec(messages_stmt).all()
                messages = list(messages)
                messages = sorted(messages, key=lambda x: x.created_at)

                # Take only the most recent messages
                if len(messages) > recent:
                    messages = messages[-recent:]

                messages_data = [
                    {
                        "created_at": msg.created_at.isoformat()
                        if msg.created_at
                        else None,
                        "type": msg.type,
                        "content": msg.content,
                        "completed": msg.completed,
                    }
                    for msg in messages
                ]

                # Get grades
                grade_stmt = select(SimulationChatGrades).where(
                    SimulationChatGrades.simulation_chat_id == chat.id
                )
                grade = session.exec(grade_stmt).first()

                grade_data = {}
                feedback_data = []

                if grade:
                    grade_data = {
                        "score": grade.score,
                        "passed": grade.passed,
                        "time_taken": grade.time_taken,
                        "created_at": grade.created_at.isoformat()
                        if grade.created_at
                        else None,
                    }

                    # Get feedback
                    feedback_stmt = (
                        select(SimulationChatFeedbacks, Standards)
                        .join(
                            Standards,
                            SimulationChatFeedbacks.standard_id == Standards.id,
                        )
                        .where(
                            SimulationChatFeedbacks.simulation_chat_grade_id == grade.id
                        )
                    )

                    feedbacks = session.exec(feedback_stmt).all()
                    feedback_data = [
                        {
                            "standard": standard.name,
                            "points": feedback.total,
                            "feedback": feedback.feedback,
                        }
                        for feedback, standard in feedbacks
                    ]

                attempts_data.append(
                    {
                        "simulation_id": str(simulation.id),
                        "title": simulation.title,
                        "scenario": scenario_data,
                        "chat": {
                            "id": str(chat.id),
                            "title": chat.title,
                            "completed": chat.completed,
                            "completed_at": chat.completed_at.isoformat()
                            if chat.completed_at
                            else None,
                            "messages": messages_data,
                            "grade": grade_data,
                            "feedback": feedback_data,
                        },
                    }
                )

        return {"profile": profile_data, "attempts": attempts_data}

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
