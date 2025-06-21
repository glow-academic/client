# generic_server.py  — "Domain-API" MCP server
import uuid
from datetime import datetime
from typing import Any, Dict, List

from app.db import get_session
from app.models import (Agents, Classes, Cohorts, Components, Dashboards,
                        EvalChatFeedbacks, EvalChatGrades, EvalChats,
                        EvalMessages, EvalRuns, Profiles, Rubrics, Scenarios,
                        SimulationAttempts, SimulationChatFeedbacks,
                        SimulationChatGrades, SimulationChats,
                        SimulationMessages, Simulations, StandardGroups,
                        Standards)
from mcp.server.fastmcp import FastMCP
from sqlalchemy import desc, func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import and_, or_, select

# ─────────────────────────────────────────────────────────────────────────────
generic = FastMCP("Domain-API")

# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Dashboard-editing helpers
# ─────────────────────────────────────────────────────────────────────────────

@generic.tool()
def update_component_layout(component_id: str, layout: Dict[str, Any]) -> str:
    """
    Overwrite the JSONB `layout` of a single `Components` row.

    Expected workflow
    -----------------
    1. `SELECT * FROM components WHERE id = :component_id FOR UPDATE`.
    2. Merge/replace the layout field with the supplied `layout`.
    3. `UPDATE components SET layout = :layout, updated_at = now()` …
    4. Return the component UUID (or 'OK').

    Security / validation
    ---------------------
    • Ensure caller is authorised to edit this component (join through `Dashboards` ➜ `Profiles`).  
    • Validate the JSON shape (e.g. contains `x, y, w, h`).

    Returns
    -------
    "OK" on success *or* the updated component UUID.
    """
    try:
        component_uuid = uuid.UUID(component_id)
    except ValueError:
        raise ValueError(f"Invalid component_id format: {component_id}")
    
    # get the session
    with get_session() as session:
        try:
            # Get the component with FOR UPDATE lock
            component = session.get(Components, component_uuid)
            if not component:
                raise ValueError(f"Component with id {component_id} not found")
            
            # Merge the layout - preserve existing fields and add/update new ones
            existing_layout = component.layout or {}
            merged_layout = {**existing_layout, **layout}
            
            # Update the component
            component.layout = merged_layout
            component.updated_at = datetime.utcnow()
            
            session.add(component)
            session.commit()
            
            return str(component.id)
            
        except SQLAlchemyError as e:
            session.rollback()
            raise Exception(f"Database error updating component layout: {str(e)}")


@generic.tool()
def patch_dashboard_settings(
    profile_id: str,
    settings: Dict[str, Any]
) -> str:
    """
    Partially update a `Dashboards` row (e.g. auto_scroll, main_split).

    Steps
    -----
    1. Fetch dashboard for `profile_id`; create if missing.
    2. Apply diff only to recognised columns.
    3. Commit & return the dashboard UUID.

    *Write-side changes live in generic_server, never in db_server.*
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise ValueError(f"Invalid profile_id format: {profile_id}")
    
    with get_session() as session:
        try:
            # Check if profile exists
            profile = session.get(Profiles, profile_uuid)
            if not profile:
                raise ValueError(f"Profile with id {profile_id} not found")
            
            # Find existing dashboard for this profile
            stmt = select(Dashboards).where(Dashboards.profile_id == profile_uuid)
            dashboard = session.exec(stmt).first()
            
            # If no dashboard exists, create one based on global dashboard (profile_id=None)
            if not dashboard:
                # Get global dashboard as template
                global_stmt = select(Dashboards).where(Dashboards.profile_id == None)
                global_dashboard = session.exec(global_stmt).first()
                
                if global_dashboard:
                    # Create new dashboard based on global template
                    dashboard = Dashboards(
                        profile_id=profile_uuid,
                        header_component_ids=global_dashboard.header_component_ids,
                        primary_component_ids=global_dashboard.primary_component_ids,
                        secondary_component_ids=global_dashboard.secondary_component_ids,
                        footer_component_ids=global_dashboard.footer_component_ids,
                        auto_scroll=global_dashboard.auto_scroll,
                        show_indicators=global_dashboard.show_indicators,
                        header_components=global_dashboard.header_components,
                        main_split=global_dashboard.main_split,
                        footer_split=global_dashboard.footer_split
                    )
                else:
                    # Create new dashboard with defaults
                    dashboard = Dashboards(profile_id=profile_uuid)
                
                session.add(dashboard)
                session.flush()  # Get the ID
            
            # Apply settings updates - only allow recognized columns
            allowed_fields = {
                'auto_scroll', 'show_indicators', 'header_components', 
                'main_split', 'footer_split', 'header_component_ids',
                'primary_component_ids', 'secondary_component_ids', 
                'footer_component_ids'
            }
            
            for field, value in settings.items():
                if field in allowed_fields and hasattr(dashboard, field):
                    setattr(dashboard, field, value)
            
            dashboard.updated_at = datetime.utcnow()
            session.add(dashboard)
            session.commit()
            
            return str(dashboard.id)
            
        except SQLAlchemyError as e:
            session.rollback()
            raise Exception(f"Database error updating dashboard settings: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Student / chat analytics helpers
# ─────────────────────────────────────────────────────────────────────────────

@generic.tool()
def get_student_simulation_report(profile_id: str) -> Dict[str, Any]:
    """
    Aggregate everything about one student across simulations.

    Output schema (example)
    -----------------------
    {
      "profile": { "id": "...", "name": "...", … },
      "attempts": [
        {
          "simulation_id": "...",
          "title": "Cardiac Arrest",
          "scenario": { "id": "...", "name": "…" },
          "chat": {
            "messages": [ {"t": "...", "role": "user", "content": "..."}, … ],
            "grade":    { "score": 87, "passed": true, … },
            "feedback": [ {"standard": "Clarity", "pts": 2, "comment": "…"}, … ]
          }
        },
        …
      ]
    }

    Implementation notes
    --------------------
    • Join chain: `Profiles ➜ SimulationAttempts ➜ SimulationChats`  
      → then LEFT JOIN grades & feedback tables.  
    • Cap messages to latest *N* or summarise to avoid huge payloads.  
    • Return JSON-serialisable primitives only.
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise ValueError(f"Invalid profile_id format: {profile_id}")
    
    with get_session() as session:
        try:
            # Get profile
            profile = session.get(Profiles, profile_uuid)
            if not profile:
                return {}
            
            profile_data = {
                "id": str(profile.id),
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "alias": profile.alias,
                "role": profile.role,
                "created_at": profile.created_at.isoformat() if profile.created_at else None
            }
            
            # Get all simulation attempts for this profile
            attempts_stmt = select(SimulationAttempts).where(
                SimulationAttempts.profile_id == profile_uuid
            ).order_by(desc(SimulationAttempts.created_at))
            
            attempts = session.exec(attempts_stmt).all()
            attempts_data = []
            
            for attempt in attempts:
                # Get simulation details
                simulation = session.get(Simulations, attempt.simulation_id)
                if not simulation:
                    continue
                
                # Get simulation chats for this attempt
                chats_stmt = select(SimulationChats).where(
                    SimulationChats.attempt_id == attempt.id
                ).order_by(desc(SimulationChats.created_at))
                
                chats = session.exec(chats_stmt).all()
                
                for chat in chats:
                    # Get scenario details
                    scenario = session.get(Scenarios, chat.scenario_id)
                    scenario_data = {
                        "id": str(scenario.id),
                        "name": scenario.name,
                        "description": scenario.description
                    } if scenario else {}
                    
                    # Get messages (limit to 50 most recent)
                    messages_stmt = select(SimulationMessages).where(
                        SimulationMessages.chat_id == chat.id
                    ).order_by(desc(SimulationMessages.created_at)).limit(50)
                    
                    messages = session.exec(messages_stmt).all()
                    messages_data = [
                        {
                            "created_at": msg.created_at.isoformat() if msg.created_at else None,
                            "type": msg.type,
                            "content": msg.content,
                            "completed": msg.completed
                        }
                        for msg in reversed(messages)  # Reverse to get chronological order
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
                            "created_at": grade.created_at.isoformat() if grade.created_at else None
                        }
                        
                        # Get feedback
                        feedback_stmt = select(
                            SimulationChatFeedbacks, Standards
                        ).join(
                            Standards, SimulationChatFeedbacks.standard_id == Standards.id
                        ).where(
                            SimulationChatFeedbacks.simulation_chat_grade_id == grade.id
                        )
                        
                        feedbacks = session.exec(feedback_stmt).all()
                        feedback_data = [
                            {
                                "standard": standard.name,
                                "points": feedback.total,
                                "feedback": feedback.feedback
                            }
                            for feedback, standard in feedbacks
                        ]
                    
                    attempts_data.append({
                        "simulation_id": str(simulation.id),
                        "title": simulation.title,
                        "scenario": scenario_data,
                        "chat": {
                            "id": str(chat.id),
                            "title": chat.title,
                            "completed": chat.completed,
                            "completed_at": chat.completed_at.isoformat() if chat.completed_at else None,
                            "messages": messages_data,
                            "grade": grade_data,
                            "feedback": feedback_data
                        }
                    })
            
            return {
                "profile": profile_data,
                "attempts": attempts_data
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error getting student simulation report: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Search helpers (read-only; heavy joins live here, ad-hoc SQL stays in db_server)
# ─────────────────────────────────────────────────────────────────────────────

@generic.tool()
def search_by_cohort(cohort_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Return high-level info scoped to one cohort:

    • Cohort metadata + roster  
    • Classes tied to those profiles (`class_ids`)  
    • Active simulations / scenarios linked via the cohort → simulations.cohort_ids
    """
    try:
        cohort_uuid = uuid.UUID(cohort_id)
    except ValueError:
        raise ValueError(f"Invalid cohort_id format: {cohort_id}")
    
    with get_session() as session:
        try:
            # Get cohort
            cohort = session.get(Cohorts, cohort_uuid)
            if not cohort:
                return {}
            
            cohort_data = {
                "id": str(cohort.id),
                "title": cohort.title,
                "description": cohort.description,
                "active": cohort.active,
                "created_at": cohort.created_at.isoformat() if cohort.created_at else None
            }
            
            # Get profiles in this cohort
            if cohort.profile_ids:
                profiles_stmt = select(Profiles).where(
                    Profiles.id.in_(cohort.profile_ids)
                ).limit(limit)
                profiles = session.exec(profiles_stmt).all()
                
                roster = [
                    {
                        "id": str(profile.id),
                        "first_name": profile.first_name,
                        "last_name": profile.last_name,
                        "alias": profile.alias,
                        "role": profile.role
                    }
                    for profile in profiles
                ]
                
                # Get unique class IDs from all profiles
                all_class_ids = set()
                for profile in profiles:
                    if profile.class_ids:
                        all_class_ids.update(profile.class_ids)
                
                # Get class details
                if all_class_ids:
                    classes_stmt = select(Classes).where(
                        Classes.id.in_(list(all_class_ids))
                    )
                    classes = session.exec(classes_stmt).all()
                    classes_data = [
                        {
                            "id": str(cls.id),
                            "name": cls.name,
                            "class_code": cls.class_code,
                            "year": cls.year,
                            "term": cls.term
                        }
                        for cls in classes
                    ]
                else:
                    classes_data = []
            else:
                roster = []
                classes_data = []
            
            # Get simulations linked to this cohort
            simulations_stmt = select(Simulations).where(
                and_(
                    Simulations.cohort_ids.contains([cohort_uuid]),
                    Simulations.active == True
                )
            ).limit(limit)
            simulations = session.exec(simulations_stmt).all()
            
            simulations_data = [
                {
                    "id": str(sim.id),
                    "title": sim.title,
                    "active": sim.active,
                    "scenario_ids": [str(sid) for sid in sim.scenario_ids],
                    "time_limit": sim.time_limit
                }
                for sim in simulations
            ]
            
            return {
                "cohort": cohort_data,
                "roster": roster,
                "classes": classes_data,
                "simulations": simulations_data
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error searching by cohort: {str(e)}")


@generic.tool()
def search_by_profile(profile_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Return a student-centric view:

    • Profile & user info  
    • Classes enrolled, dashboard settings  
    • SimulationAttempts (+ latest grades)  
    • AssistantChats history metadata (no full messages)
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise ValueError(f"Invalid profile_id format: {profile_id}")
    
    with get_session() as session:
        try:
            # Get profile with user info
            profile_stmt = select(Profiles).where(Profiles.id == profile_uuid)
            profile = session.exec(profile_stmt).first()
            
            if not profile:
                return {}
            
            profile_data = {
                "id": str(profile.id),
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "alias": profile.alias,
                "role": profile.role,
                "viewed_intro": profile.viewed_intro,
                "last_login": profile.last_login.isoformat() if profile.last_login else None,
                "created_at": profile.created_at.isoformat() if profile.created_at else None
            }
            
            # Get user info if available
            user_data = {}
            if profile.user:
                user_data = {
                    "id": profile.user.id,
                    "name": profile.user.name,
                    "email": profile.user.email
                }
            
            # Get classes
            classes_data = []
            if profile.class_ids:
                classes_stmt = select(Classes).where(
                    Classes.id.in_(profile.class_ids)
                )
                classes = session.exec(classes_stmt).all()
                classes_data = [
                    {
                        "id": str(cls.id),
                        "name": cls.name,
                        "class_code": cls.class_code,
                        "year": cls.year,
                        "term": cls.term
                    }
                    for cls in classes
                ]
            
            # Get dashboard settings
            dashboard_stmt = select(Dashboards).where(Dashboards.profile_id == profile_uuid)
            dashboard = session.exec(dashboard_stmt).first()
            dashboard_data = {}
            if dashboard:
                dashboard_data = {
                    "id": str(dashboard.id),
                    "auto_scroll": dashboard.auto_scroll,
                    "show_indicators": dashboard.show_indicators,
                    "main_split": dashboard.main_split,
                    "footer_split": dashboard.footer_split
                }
            
            # Get simulation attempts with latest grades
            attempts_stmt = select(SimulationAttempts).where(
                SimulationAttempts.profile_id == profile_uuid
            ).order_by(desc(SimulationAttempts.created_at)).limit(limit)
            
            attempts = session.exec(attempts_stmt).all()
            attempts_data = []
            
            for attempt in attempts:
                simulation = session.get(Simulations, attempt.simulation_id)
                if not simulation:
                    continue
                
                # Get latest chat and grade for this attempt
                chat_stmt = select(SimulationChats).where(
                    SimulationChats.attempt_id == attempt.id
                ).order_by(desc(SimulationChats.created_at))
                
                latest_chat = session.exec(chat_stmt).first()
                grade_data = {}
                
                if latest_chat:
                    grade_stmt = select(SimulationChatGrades).where(
                        SimulationChatGrades.simulation_chat_id == latest_chat.id
                    )
                    grade = session.exec(grade_stmt).first()
                    
                    if grade:
                        grade_data = {
                            "score": grade.score,
                            "passed": grade.passed,
                            "time_taken": grade.time_taken
                        }
                
                attempts_data.append({
                    "id": str(attempt.id),
                    "simulation_title": simulation.title,
                    "created_at": attempt.created_at.isoformat() if attempt.created_at else None,
                    "latest_grade": grade_data
                })
            
            return {
                "profile": profile_data,
                "user": user_data,
                "classes": classes_data,
                "dashboard": dashboard_data,
                "simulation_attempts": attempts_data
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error searching by profile: {str(e)}")


@generic.tool()
def search_by_class(class_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Summarise a class:

    • Class record + schedules/events/topics  
    • Roster (Profiles) ➜ include alias + role  
    • Scenarios & simulations where class_id matches
    """
    try:
        class_uuid = uuid.UUID(class_id)
    except ValueError:
        raise ValueError(f"Invalid class_id format: {class_id}")
    
    with get_session() as session:
        try:
            # Get class
            class_obj = session.get(Classes, class_uuid)
            if not class_obj:
                return {}
            
            class_data = {
                "id": str(class_obj.id),
                "name": class_obj.name,
                "class_code": class_obj.class_code,
                "year": class_obj.year,
                "term": class_obj.term,
                "description": class_obj.description,
                "created_at": class_obj.created_at.isoformat() if class_obj.created_at else None
            }
            
            # Get roster - profiles that have this class in their class_ids
            roster_stmt = select(Profiles).where(
                Profiles.class_ids.contains([class_uuid])
            ).limit(limit)
            profiles = session.exec(roster_stmt).all()
            
            roster = [
                {
                    "id": str(profile.id),
                    "first_name": profile.first_name,
                    "last_name": profile.last_name,
                    "alias": profile.alias,
                    "role": profile.role
                }
                for profile in profiles
            ]
            
            # Get scenarios linked to this class
            scenarios_stmt = select(Scenarios).where(
                Scenarios.class_id == class_uuid
            ).limit(limit)
            scenarios = session.exec(scenarios_stmt).all()
            
            scenarios_data = [
                {
                    "id": str(scenario.id),
                    "name": scenario.name,
                    "description": scenario.description,
                    "default_scenario": scenario.default_scenario
                }
                for scenario in scenarios
            ]
            
            return {
                "class": class_data,
                "roster": roster,
                "scenarios": scenarios_data
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error searching by class: {str(e)}")


@generic.tool()
def search_by_simulation(simulation_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Drill into one simulation:

    • Simulation metadata, rubric summary  
    • Cohorts / scenarios involved  
    • Attempt counts, pass-rate, latest grades per profile (aggregate)
    """
    try:
        simulation_uuid = uuid.UUID(simulation_id)
    except ValueError:
        raise ValueError(f"Invalid simulation_id format: {simulation_id}")
    
    with get_session() as session:
        try:
            # Get simulation
            simulation = session.get(Simulations, simulation_uuid)
            if not simulation:
                return {}
            
            simulation_data = {
                "id": str(simulation.id),
                "title": simulation.title,
                "active": simulation.active,
                "time_limit": simulation.time_limit,
                "created_at": simulation.created_at.isoformat() if simulation.created_at else None
            }
            
            # Get rubric info
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
                cohorts_stmt = select(Cohorts).where(
                    Cohorts.id.in_(simulation.cohort_ids)
                )
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
                scenarios_stmt = select(Scenarios).where(
                    Scenarios.id.in_(simulation.scenario_ids)
                )
                scenarios = session.exec(scenarios_stmt).all()
                scenarios_data = [
                    {
                        "id": str(scenario.id),
                        "name": scenario.name,
                        "description": scenario.description
                    }
                    for scenario in scenarios
                ]
            
            # Get attempt statistics
            attempts_stmt = select(SimulationAttempts).where(
                SimulationAttempts.simulation_id == simulation_uuid
            )
            attempts = session.exec(attempts_stmt).all()
            
            total_attempts = len(attempts)
            
            # Calculate pass rate from grades
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
                "statistics": {
                    "total_attempts": total_attempts,
                    "total_graded": total_graded,
                    "pass_rate": round(pass_rate, 2)
                }
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error searching by simulation: {str(e)}")


@generic.tool()
def search_by_scenario(scenario_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Detail a scenario:

    • Scenario record + linked class & agent  
    • SimulationChats + EvalChats counts  
    • Recent feedback themes (group by Standard)
    """
    try:
        scenario_uuid = uuid.UUID(scenario_id)
    except ValueError:
        raise ValueError(f"Invalid scenario_id format: {scenario_id}")
    
    with get_session() as session:
        try:
            # Get scenario
            scenario = session.get(Scenarios, scenario_uuid)
            if not scenario:
                return {}
            
            scenario_data = {
                "id": str(scenario.id),
                "name": scenario.name,
                "description": scenario.description,
                "default_scenario": scenario.default_scenario,
                "crowdedness": scenario.crowdedness,
                "intensity": scenario.intensity,
                "seniority": scenario.seniority,
                "created_at": scenario.created_at.isoformat() if scenario.created_at else None
            }
            
            # Get linked class
            class_data = {}
            if scenario.class_id:
                class_obj = session.get(Classes, scenario.class_id)
                if class_obj:
                    class_data = {
                        "id": str(class_obj.id),
                        "name": class_obj.name,
                        "class_code": class_obj.class_code
                    }
            
            # Get linked agent
            agent_data = {}
            if scenario.agent_id:
                agent = session.get(Agents, scenario.agent_id)
                if agent:
                    agent_data = {
                        "id": str(agent.id),
                        "name": agent.name,
                        "description": agent.description
                    }
            
            # Count simulation chats
            sim_chats_stmt = select(func.count(SimulationChats.id)).where(
                SimulationChats.scenario_id == scenario_uuid
            )
            sim_chats_count = session.exec(sim_chats_stmt).one()
            
            # Count eval chats
            eval_chats_stmt = select(func.count(EvalChats.id)).where(
                EvalChats.scenario_id == scenario_uuid
            )
            eval_chats_count = session.exec(eval_chats_stmt).one()
            
            return {
                "scenario": scenario_data,
                "class": class_data,
                "agent": agent_data,
                "usage_stats": {
                    "simulation_chats": sim_chats_count,
                    "eval_chats": eval_chats_count
                }
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error searching by scenario: {str(e)}")


@generic.tool()
def search_by_agent(agent_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Agent dashboard:

    • Agent config (system_prompt, temperature)  
    • Scenarios powered by this agent  
    • EvalRuns history & pass-rate statistics
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        raise ValueError(f"Invalid agent_id format: {agent_id}")
    
    with get_session() as session:
        try:
            # Get agent
            agent = session.get(Agents, agent_uuid)
            if not agent:
                return {}
            
            agent_data = {
                "id": str(agent.id),
                "name": agent.name,
                "description": agent.description,
                "system_prompt": agent.system_prompt,
                "temperature": agent.temperature,
                "default_agent": agent.default_agent,
                "editable": agent.editable,
                "created_at": agent.created_at.isoformat() if agent.created_at else None
            }
            
            # Get model info
            model_data = {}
            if agent.model:
                model_data = {
                    "id": str(agent.model.id),
                    "name": agent.model.name,
                    "description": agent.model.description
                }
            
            # Get scenarios powered by this agent
            scenarios_stmt = select(Scenarios).where(
                Scenarios.agent_id == agent_uuid
            ).limit(limit)
            scenarios = session.exec(scenarios_stmt).all()
            
            scenarios_data = [
                {
                    "id": str(scenario.id),
                    "name": scenario.name,
                    "description": scenario.description
                }
                for scenario in scenarios
            ]
            
            # Get eval runs statistics
            eval_runs_stmt = select(EvalRuns).where(
                EvalRuns.agent_id == agent_uuid
            ).order_by(desc(EvalRuns.created_at)).limit(limit)
            eval_runs = session.exec(eval_runs_stmt).all()
            
            eval_runs_data = []
            total_evals = 0
            total_passed = 0
            
            for eval_run in eval_runs:
                # Count eval chats and grades for this run
                eval_chats_stmt = select(EvalChats).where(
                    EvalChats.eval_run_id == eval_run.id
                )
                eval_chats = session.exec(eval_chats_stmt).all()
                
                run_total = 0
                run_passed = 0
                
                for eval_chat in eval_chats:
                    grade_stmt = select(EvalChatGrades).where(
                        EvalChatGrades.eval_chat_id == eval_chat.id
                    )
                    grade = session.exec(grade_stmt).first()
                    
                    if grade:
                        run_total += 1
                        total_evals += 1
                        if grade.passed:
                            run_passed += 1
                            total_passed += 1
                
                eval_runs_data.append({
                    "id": str(eval_run.id),
                    "created_at": eval_run.created_at.isoformat() if eval_run.created_at else None,
                    "total_chats": run_total,
                    "passed_chats": run_passed,
                    "pass_rate": round((run_passed / run_total * 100) if run_total > 0 else 0, 2)
                })
            
            overall_pass_rate = (total_passed / total_evals * 100) if total_evals > 0 else 0
            
            return {
                "agent": agent_data,
                "model": model_data,
                "scenarios": scenarios_data,
                "eval_statistics": {
                    "total_eval_runs": len(eval_runs),
                    "total_evaluations": total_evals,
                    "overall_pass_rate": round(overall_pass_rate, 2),
                    "recent_runs": eval_runs_data
                }
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"Database error searching by agent: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Utilities (optional): row-limit decorator, JSON serialiser helpers, etc.
# ─────────────────────────────────────────────────────────────────────────────
