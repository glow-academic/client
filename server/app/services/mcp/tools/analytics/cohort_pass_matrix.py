# cohort_pass_matrix.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict, List

from app.db import get_session
from app.models import (Cohorts, Profiles, SimulationAttempts,
                        SimulationChatGrades, SimulationChats, Simulations)
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def cohort_pass_matrix(cohort_id: str) -> Dict[str, Any]:
    """
    📈 Cohort pass/fail matrix across simulations
    ---------------------------------------------
    Show pass/fail rates for all students in a cohort.
    
    Input
      • cohort_id – UUID of the cohort
    
    Returns
      { "cohort": {…}, "matrix": [{…}], "summary": {…} }
    
    Quick-start
      ask:  "Show pass rates for cohort X"
      call: cohort_pass_matrix("uuid-here")
    
    See also 👉 cohort_overview() for cohort details.
    """
    try:
        cohort_uuid = uuid.UUID(cohort_id)
    except ValueError:
        return {"error": f"Invalid cohort_id format: {cohort_id}"}
    
    session = next(get_session())
    try:
        # Get cohort details
        cohort = session.get(Cohorts, cohort_uuid)
        if not cohort:
            return {"error": f"Cohort not found: {cohort_id}"}
        
        # Get cohort members
        cohort_members = []
        for profile_id in cohort.profile_ids:
            profile = session.get(Profiles, profile_id)
            if profile:
                cohort_members.append(profile)
        
        # Get simulations for this cohort
        simulations_stmt = select(Simulations)
        all_simulations = session.exec(simulations_stmt).all()
        
        cohort_simulations = []
        for sim in all_simulations:
            if cohort_uuid in sim.cohort_ids:
                cohort_simulations.append(sim)
        
        # Build pass/fail matrix
        matrix = []
        for student in cohort_members:
            student_name = f"{student.first_name} {student.last_name}".strip()
            if not student_name:
                student_name = student.alias
            
            student_results: Dict[str, Any] = {
                "student_id": str(student.id),
                "student_name": student_name,
                "alias": student.alias,
                "simulations": {}
            }
            
            # Get results for each simulation
            for sim in cohort_simulations:
                # Get attempts for this student and simulation
                attempts_stmt = select(SimulationAttempts).where(
                    SimulationAttempts.profile_id == student.id,
                    SimulationAttempts.simulation_id == sim.id
                )
                attempts = session.exec(attempts_stmt).all()
                
                best_result = None
                for attempt in attempts:
                    # Get chats for this attempt
                    chats_stmt = select(SimulationChats).where(
                        SimulationChats.attempt_id == attempt.id
                    )
                    chats = session.exec(chats_stmt).all()
                    
                    if chats:
                        # Get latest chat
                        latest_chat = sorted(chats, key=lambda x: x.created_at, reverse=True)[0]
                        
                        # Get grade for latest chat
                        grade_stmt = select(SimulationChatGrades).where(
                            SimulationChatGrades.simulation_chat_id == latest_chat.id
                        )
                        grade = session.exec(grade_stmt).first()
                        
                        if grade:
                            if best_result is None or (best_result and grade.score > best_result["score"]):
                                best_result = {
                                    "score": grade.score,
                                    "passed": grade.passed,
                                    "time_taken": grade.time_taken,
                                    "attempt_count": len(attempts),
                                    "last_attempt": attempt.created_at.isoformat() if attempt.created_at else None
                                }
                
                student_results["simulations"][str(sim.id)] = best_result
            
            matrix.append(student_results)
        
        # Calculate summary statistics
        summary: Dict[str, Any] = {
            "total_students": len(cohort_members),
            "total_simulations": len(cohort_simulations),
            "simulation_stats": {}
        }
        
        for sim in cohort_simulations:
            sim_id = str(sim.id)
            passed_count = 0
            attempted_count = 0
            total_score = 0
            
            for student_result in matrix:
                if sim_id in student_result["simulations"] and student_result["simulations"][sim_id]:
                    attempted_count += 1
                    result = student_result["simulations"][sim_id]
                    if result["passed"]:
                        passed_count += 1
                    total_score += result["score"]
            
            summary["simulation_stats"][sim_id] = {
                "simulation_title": sim.title,
                "attempted_count": attempted_count,
                "passed_count": passed_count,
                "pass_rate": round(passed_count / attempted_count * 100, 1) if attempted_count > 0 else 0,
                "average_score": round(total_score / attempted_count, 1) if attempted_count > 0 else 0
            }
        
        return {
            "cohort": {
                "id": str(cohort.id),
                "title": cohort.title,
                "description": cohort.description,
                "active": cohort.active,
                "created_at": cohort.created_at.isoformat() if cohort.created_at else None
            },
            "matrix": matrix,
            "summary": summary,
            "simulations": [
                {
                    "id": str(sim.id),
                    "title": sim.title,
                    "active": sim.active,
                    "time_limit": sim.time_limit
                }
                for sim in cohort_simulations
            ]
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()