# profile_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import (
    Profiles,
    SimulationAttempts,
    SimulationChatGrades,
    SimulationChats,
    Simulations,
)
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def profile_overview(profile_id: str) -> Dict[str, Any]:
    """
    Profile overview
    ----------------
    Profile + last login, classes, dashboard flags, latest grades.
    Accepts UUID or name.

    Input
      • profile_id - UUID or name/alias to search for

    Returns
      { "profile": { … }, "classes": [ … ], "latest_grades": [ … ] }

    Quick-start
      ask:  "Show me Nina Park's profile"
      call: profile_overview("Nina Park")

    See also 👉 student_sim_report() for per-chat detail.
    """
    session = next(get_session())
    try:
        # Try UUID first
        profile = None
        try:
            profile_uuid = uuid.UUID(profile_id)
            profile = session.get(Profiles, profile_uuid)
        except ValueError:
            # Search by name
            search_pattern = f"%{profile_id.lower()}%"
            stmt = (
                select(Profiles)
                .where(
                    or_(
                        func.lower(Profiles.first_name).like(search_pattern),
                        func.lower(Profiles.last_name).like(search_pattern),
                        func.lower(Profiles.alias).like(search_pattern),
                    )
                )
                .limit(1)
            )
            profile = session.exec(stmt).first()

        if not profile:
            return {"error": f"Profile not found: {profile_id}"}

        # Get profile data
        profile_data = {
            "id": str(profile.id),
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "alias": profile.alias,
            "role": profile.role,
            "last_login": profile.last_login.isoformat()
            if profile.last_login
            else None,
            "viewed_intro": profile.viewed_intro,
            "active": profile.active,
            "created_at": profile.created_at.isoformat()
            if profile.created_at
            else None,
        }

        # Get latest simulation grades (last 5) via attempt_profiles junction
        from app.models import AttemptProfiles
        attempt_links = session.exec(
            select(AttemptProfiles).where(
                AttemptProfiles.profile_id == profile.id,
                AttemptProfiles.active == True
            )
        ).all()
        
        attempt_ids = [link.attempt_id for link in attempt_links]
        if attempt_ids:
            attempts_stmt = select(SimulationAttempts).where(
                SimulationAttempts.id.in_(attempt_ids)
            )
            attempts = session.exec(attempts_stmt).all()
            attempts = list(attempts)
            attempts = sorted(attempts, key=lambda x: x.created_at, reverse=True)[:5]
        else:
            attempts = []

        latest_grades = []
        for attempt in attempts:
            simulation = session.get(Simulations, attempt.simulation_id)
            if not simulation:
                continue

            # Get latest chat for this attempt
            chat_stmt = select(SimulationChats).where(
                SimulationChats.attempt_id == attempt.id
            )
            chats = session.exec(chat_stmt).all()
            chats = list(chats)
            chats = sorted(chats, key=lambda x: x.created_at, reverse=True)
            chat = chats[0] if chats else None

            if chat:
                grade_stmt = select(SimulationChatGrades).where(
                    SimulationChatGrades.simulation_chat_id == chat.id
                )
                grade = session.exec(grade_stmt).first()

                if grade:
                    latest_grades.append(
                        {
                            "simulation_title": simulation.title,
                            "score": grade.score,
                            "passed": grade.passed,
                            "time_taken": grade.time_taken,
                            "created_at": grade.created_at.isoformat(),
                        }
                    )

        return {
            "profile": profile_data,
            "latest_grades": latest_grades,
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
