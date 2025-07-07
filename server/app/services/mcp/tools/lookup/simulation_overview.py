# simulation_overview.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict

from app.db import get_session
from app.models import (Cohorts, Rubrics, Scenarios, SimulationAttempts,
                        SimulationChatGrades, SimulationChats, Simulations)
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def simulation_overview(sim_id: str) -> Dict[str, Any]:
    """
    🔎 Simulation overview
    ----------------------
    Sim meta, rubric, cohorts, scenarios, pass stats.
    
    Input
      • sim_id – UUID of the simulation
    
    Returns
      { "simulation": { … }, "rubric": { … }, "cohorts": [ … ], "stats": { … } }
    
    Quick-start
      ask:  "Give me the Cardiac Arrest sim stats"
      call: simulation_overview("uuid-here")
    
    See also 👉 simulation_attempts() for detailed attempt list.
    """
    try:
        simulation_uuid = uuid.UUID(sim_id)
    except ValueError:
        return {"error": f"Invalid sim_id format: {sim_id}"}
    
    session = next(get_session())
    try:
        # Get simulation
        simulation = session.get(Simulations, simulation_uuid)
        if not simulation:
            return {"error": f"Simulation not found: {sim_id}"}
        
        simulation_data = {
            "id": str(simulation.id),
            "title": simulation.title,
            "active": simulation.active,
            "time_limit": simulation.time_limit,
            "created_at": simulation.created_at.isoformat()
        }
        
        # Get rubric
        rubric = session.get(Rubrics, simulation.rubric_id)
        rubric_data = {}
        if rubric:
            rubric_data = {
                "id": str(rubric.id),
                "name": rubric.name,
                "description": rubric.description,
                "points": rubric.points,
                "pass_points": rubric.pass_points
            }
        
        # Get cohorts
        cohorts_data = []
        if simulation.cohort_ids:
            cohorts_stmt = select(Cohorts).where(Cohorts.id.in_(simulation.cohort_ids))
            cohorts = session.exec(cohorts_stmt).all()
            cohorts_data = [
                {
                    "id": str(cohort.id),
                    "title": cohort.title,
                    "active": cohort.active
                }
                for cohort in cohorts
            ]
        
        # Get scenarios
        scenarios_data = []
        if simulation.scenario_ids:
            scenarios_stmt = select(Scenarios).where(Scenarios.id.in_(simulation.scenario_ids))
            scenarios = session.exec(scenarios_stmt).all()
            scenarios_data = [
                {
                    "id": str(scenario.id),
                    "name": scenario.name,
                    "description": scenario.description
                }
                for scenario in scenarios
            ]
        
        # Calculate pass stats
        attempts_stmt = select(SimulationAttempts).where(
            SimulationAttempts.simulation_id == simulation_uuid
        )
        attempts = session.exec(attempts_stmt).all()
        
        total_attempts = len(attempts)
        total_graded = 0
        total_passed = 0
        
        for attempt in attempts:
            chats_stmt = select(SimulationChats).where(
                SimulationChats.attempt_id == attempt.id
            )
            chats = session.exec(chats_stmt).all()
            
            for chat in chats:
                grade_stmt = select(SimulationChatGrades).where(
                    SimulationChatGrades.simulation_chat_id == chat.id
                )
                grade = session.exec(grade_stmt).first()
                
                if grade:
                    total_graded += 1
                    if grade.passed:
                        total_passed += 1
        
        pass_rate = (total_passed / total_graded * 100) if total_graded > 0 else 0
        
        return {
            "simulation": simulation_data,
            "rubric": rubric_data,
            "cohorts": cohorts_data,
            "scenarios": scenarios_data,
            "stats": {
                "total_attempts": total_attempts,
                "total_graded": total_graded,
                "pass_rate": round(pass_rate, 2)
            }
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()