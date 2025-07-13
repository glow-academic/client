# simulation_attempts.py
import uuid
from typing import Any, Dict, List

from app.db import get_session
from app.models import (
    Profiles,
    SimulationAttempts,
    SimulationChatGrades,
    SimulationChats,
    Simulations,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def simulation_attempts(sim_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    """
    🔎 Flat list of attempts (who, when, score)
    -------------------------------------------
    List all attempts for a specific simulation.

    Input
      • sim_id – UUID of the simulation
      • limit – Max results (default: 200)

    Returns
      [ { "id": "…", "student": "…", "score": 85, … }, … ]

    Quick-start
      ask:  "List last 200 attempts on Sim Y"
      call: simulation_attempts("uuid-here")

    See also 👉 simulation_overview() for aggregate stats.
    """
    try:
        simulation_uuid = uuid.UUID(sim_id)
    except ValueError:
        return [{"error": f"Invalid sim_id format: {sim_id}"}]

    session = next(get_session())
    try:
        # Verify simulation exists
        simulation = session.get(Simulations, simulation_uuid)
        if not simulation:
            return [{"error": f"Simulation not found: {sim_id}"}]

        # Get all attempts for this simulation
        attempts_stmt = select(SimulationAttempts).where(
            SimulationAttempts.simulation_id == simulation_uuid
        )
        attempts = session.exec(attempts_stmt).all()
        attempts = list(attempts)
        attempts = sorted(attempts, key=lambda x: x.created_at, reverse=True)[:limit]

        results = []

        for attempt in attempts:
            # Get student info
            student_name = "Unknown"
            if attempt.profile_id:
                profile = session.get(Profiles, attempt.profile_id)
                if profile:
                    name_parts = []
                    if profile.first_name:
                        name_parts.append(profile.first_name)
                    if profile.last_name:
                        name_parts.append(profile.last_name)
                    student_name = (
                        " ".join(name_parts)
                        if name_parts
                        else profile.alias or "Unknown"
                    )

            # Get latest grade for this attempt
            chats_stmt = select(SimulationChats).where(
                SimulationChats.attempt_id == attempt.id
            )
            chats = session.exec(chats_stmt).all()

            latest_score = None
            latest_passed = None
            latest_time_taken = None

            if chats:
                chats = list(chats)
                chats = sorted(chats, key=lambda x: x.created_at, reverse=True)
                latest_chat = chats[0]

                grade_stmt = select(SimulationChatGrades).where(
                    SimulationChatGrades.simulation_chat_id == latest_chat.id
                )
                grade = session.exec(grade_stmt).first()

                if grade:
                    latest_score = grade.score
                    latest_passed = grade.passed
                    latest_time_taken = grade.time_taken

            results.append(
                {
                    "id": str(attempt.id),
                    "student": student_name,
                    "student_id": str(attempt.profile_id)
                    if attempt.profile_id
                    else None,
                    "score": latest_score,
                    "passed": latest_passed,
                    "time_taken": latest_time_taken,
                    "created_at": attempt.created_at.isoformat()
                    if attempt.created_at
                    else None,
                }
            )

        return results

    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()
