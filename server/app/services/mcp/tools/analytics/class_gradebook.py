# class_gradebook.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import (
    Classes,
    Cohorts,
    Profiles,
    SimulationAttempts,
    SimulationChatGrades,
    SimulationChats,
    Simulations,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def class_gradebook(class_id: str) -> Dict[str, Any]:
    """
    Class gradebook with all student grades
    Show all students in a class with their simulation performance.

    Input
      • class_id - UUID of the class

    Returns
      { "class": {…}, "students": [{…}], "simulations": [{…}] }

    Quick-start
      ask:  "Show me the gradebook for class X"
      call: class_gradebook("uuid-here")

    See also profile_overview() for individual student details.
    """
    try:
        class_uuid = uuid.UUID(class_id)
    except ValueError:
        return {"error": f"Invalid class_id format: {class_id}"}

    session = next(get_session())
    try:
        # Get class details
        class_obj = session.get(Classes, class_uuid)
        if not class_obj:
            return {"error": f"Class not found: {class_id}"}

        # Get all cohorts for this class
        cohorts_stmt = select(Cohorts)
        cohorts = session.exec(cohorts_stmt).all()

        # Get all profiles that belong to this class
        profiles_stmt = select(Profiles)
        all_profiles = session.exec(profiles_stmt).all()

        class_students = []
        for profile in all_profiles:
            if class_uuid in profile.class_ids:
                class_students.append(profile)

        # Get all simulations that have cohorts containing class students
        simulations_stmt = select(Simulations)
        simulations = session.exec(simulations_stmt).all()

        # Build student gradebook
        student_grades = []
        for student in class_students:
            student_name = f"{student.first_name} {student.last_name}".strip()
            if not student_name:
                student_name = student.alias

            # Get all attempts for this student
            attempts_stmt = select(SimulationAttempts).where(
                SimulationAttempts.profile_id == student.id
            )
            attempts = session.exec(attempts_stmt).all()

            # Get grades for each simulation
            simulation_grades: Dict[str, Dict[str, Any]] = {}
            for attempt in attempts:
                # Get chats for this attempt
                chats_stmt = select(SimulationChats).where(
                    SimulationChats.attempt_id == attempt.id
                )
                chats = session.exec(chats_stmt).all()

                if chats:
                    # Get latest chat
                    latest_chat = sorted(
                        chats, key=lambda x: x.created_at, reverse=True
                    )[0]

                    # Get grade for latest chat
                    grade_stmt = select(SimulationChatGrades).where(
                        SimulationChatGrades.simulation_chat_id == latest_chat.id
                    )
                    grade = session.exec(grade_stmt).first()

                    if grade:
                        sim_id = str(attempt.simulation_id)
                        if (
                            sim_id not in simulation_grades
                            or grade.score > simulation_grades[sim_id]["score"]
                        ):
                            simulation_grades[sim_id] = {
                                "score": grade.score,
                                "passed": grade.passed,
                                "time_taken": grade.time_taken,
                                "attempt_date": attempt.created_at.isoformat()
                                if attempt.created_at
                                else None,
                            }

            student_grades.append(
                {
                    "id": str(student.id),
                    "name": student_name,
                    "alias": student.alias,
                    "role": student.role,
                    "active": student.active,
                    "grades": simulation_grades,
                }
            )

        # Get simulation summaries
        simulation_summaries = []
        for sim in simulations:
            # Check if this simulation has any attempts from class students
            has_class_attempts = any(
                str(attempt.simulation_id) == str(sim.id)
                for student in class_students
                for attempt in session.exec(
                    select(SimulationAttempts).where(
                        SimulationAttempts.profile_id == student.id,
                        SimulationAttempts.simulation_id == sim.id,
                    )
                ).all()
            )

            if has_class_attempts:
                simulation_summaries.append(
                    {
                        "id": str(sim.id),
                        "title": sim.title,
                        "active": sim.active,
                        "time_limit": sim.time_limit,
                    }
                )

        return {
            "class": {
                "id": str(class_obj.id),
                "name": class_obj.name,
                "class_code": class_obj.class_code,
                "year": class_obj.year,
                "term": class_obj.term,
                "description": class_obj.description,
            },
            "students": student_grades,
            "simulations": simulation_summaries,
            "student_count": len(student_grades),
            "simulation_count": len(simulation_summaries),
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
