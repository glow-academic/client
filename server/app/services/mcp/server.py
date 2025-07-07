# server_server.py  — "Domain-API" MCP server (Read-Only Analytics)
import csv
import io
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from app.db import engine, get_session
from app.models import (Agents, AppLogs, AssistantChats, AssistantMessages,
                        AssistantToolCalls, Classes, Cohorts, Models, Profiles,
                        Rubrics, Scenarios, SimulationAttempts,
                        SimulationChatFeedbacks, SimulationChatGrades,
                        SimulationChats, SimulationMessages, Simulations,
                        StandardGroups, Standards)
from mcp.server.fastmcp import FastMCP
from sqlalchemy import desc, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import and_, or_, select

# ─────────────────────────────────────────────────────────────────────────────
# Configure for stateless HTTP transport
server = FastMCP("Domain-API", stateless_http=True)

# ─────────────────────────────────────────────────────────────────────────────
# ✱ Schema / Meta Tools
# ─────────────────────────────────────────────────────────────────────────────

@server.resource("schema://public")
def list_schema() -> str:
    """
    🔎 Database schema overview
    ---------------------------
    Lists all tables and columns in the public schema.
    
    Quick-start
      ask:  "What tables are in the DB?"
      call: list_schema()
    """
    sql = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """
    with engine.connect() as conn:
        rows = conn.execute(text(sql))
        return "\n".join(f"{t}.{c} {d}" for t, c, d in rows)

@server.tool()
def query_data(sql: str) -> str:
    """
    🔎 Custom SQL queries (read-only)
    ---------------------------------
    Run SELECT/EXPLAIN queries with 200-row limit.
    
    Input
      • sql – SELECT or EXPLAIN statement only
    
    Returns
      Raw query results as text
    
    Quick-start
      ask:  "Run this SQL: SELECT * FROM profiles LIMIT 5"
      call: query_data("SELECT first_name, last_name FROM profiles LIMIT 5")
    
    Security: Only SELECT and EXPLAIN allowed.
    """
    lowered = sql.lstrip().lower()
    if not lowered.startswith(("select", "explain")):
        return "Error: only read-only queries are allowed."

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchmany(200)
            return "\n".join(str(r) for r in rows) or "↩️ (0 rows)"
    except SQLAlchemyError as e:
        return f"Error: {e}"

# ─────────────────────────────────────────────────────────────────────────────
# ✱ Quick Look-ups (3-8)
# ─────────────────────────────────────────────────────────────────────────────

@server.tool()
def profile_overview(key: str) -> Dict[str, Any]:
    """
    🔎 Profile overview
    -------------------
    Profile + last login, classes, dashboard flags, latest grades. 
    Accepts UUID or name.
    
    Input
      • key – UUID or name/alias to search for
    
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
            profile_uuid = uuid.UUID(key)
            profile = session.get(Profiles, profile_uuid)
        except ValueError:
            # Search by name
            search_pattern = f"%{key.lower()}%"
            stmt = select(Profiles).where(
                or_(
                    func.lower(Profiles.first_name).like(search_pattern),
                    func.lower(Profiles.last_name).like(search_pattern),
                    func.lower(Profiles.alias).like(search_pattern)
                )
            ).limit(1)
            profile = session.exec(stmt).first()
        
        if not profile:
            return {"error": f"Profile not found: {key}"}
        
        # Get profile data
        profile_data = {
            "id": str(profile.id),
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "alias": profile.alias,
            "role": profile.role,
            "last_login": profile.last_login.isoformat() if profile.last_login else None,
            "viewed_intro": profile.viewed_intro,
            "active": profile.active,
            "created_at": profile.created_at.isoformat() if profile.created_at else None
        }
        
        # Get classes
        classes_data = []
        if profile.class_ids:
            classes_stmt = select(Classes).where(Classes.id.in_(profile.class_ids))
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
        
        # Get latest simulation grades (last 5)
        attempts_stmt = select(SimulationAttempts).where(
            SimulationAttempts.profile_id == profile.id
        ).order_by(desc(SimulationAttempts.created_at)).limit(5)
        attempts = session.exec(attempts_stmt).all()
        
        latest_grades = []
        for attempt in attempts:
            simulation = session.get(Simulations, attempt.simulation_id)
            if not simulation:
                continue
                
            # Get latest chat for this attempt
            chat_stmt = select(SimulationChats).where(
                SimulationChats.attempt_id == attempt.id
            ).order_by(desc(SimulationChats.created_at)).limit(1)
            chat = session.exec(chat_stmt).first()
            
            if chat:
                grade_stmt = select(SimulationChatGrades).where(
                    SimulationChatGrades.simulation_chat_id == chat.id
                )
                grade = session.exec(grade_stmt).first()
                
                if grade:
                    latest_grades.append({
                        "simulation_title": simulation.title,
                        "score": grade.score,
                        "passed": grade.passed,
                        "time_taken": grade.time_taken,
                        "created_at": grade.created_at.isoformat()
                    })
        
        return {
            "profile": profile_data,
            "classes": classes_data,
            "latest_grades": latest_grades
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}

@server.tool()
def class_overview(class_id: str) -> Dict[str, Any]:
    """
    🔎 Class overview
    -----------------
    Class record, roster, topics, scenarios.
    
    Input
      • class_id – UUID of the class
    
    Returns
      { "class": { … }, "roster": [ … ], "scenarios": [ … ] }
    
    Quick-start
      ask:  "Summarise CS-7643 Spring 30"
      call: class_overview("uuid-here")
    
    See also 👉 find_classes() to search by name/code.
    """
    try:
        class_uuid = uuid.UUID(class_id)
    except ValueError:
        return {"error": f"Invalid class_id format: {class_id}"}
    
    session = next(get_session())
    try:
        # Get class
        class_obj = session.get(Classes, class_uuid)
        if not class_obj:
            return {"error": f"Class not found: {class_id}"}
        
        class_data = {
            "id": str(class_obj.id),
            "name": class_obj.name,
            "class_code": class_obj.class_code,
            "year": class_obj.year,
            "term": class_obj.term,
            "description": class_obj.description,
            "created_at": class_obj.created_at.isoformat()
        }
        
        # Get roster
        roster_stmt = select(Profiles).where(
            class_uuid.in_(Profiles.class_ids)
        )
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
        
        # Get scenarios
        scenarios_stmt = select(Scenarios).where(Scenarios.class_id == class_uuid)
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
        return {"error": f"Database error: {str(e)}"}

# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Dashboard-editing helpers
# ─────────────────────────────────────────────────────────────────────────────

@server.tool()
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
    session = next(get_session())
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


@server.tool()
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

    *Write-side changes live in server_server, never in db_server.*
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        raise ValueError(f"Invalid profile_id format: {profile_id}")
    
    session = next(get_session())
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
        
        dashboard.updated_at = datetime.now(timezone.utc)
        session.add(dashboard)
        session.commit()
        
        return str(dashboard.id)
        
    except SQLAlchemyError as e:
        session.rollback()
        raise Exception(f"Database error updating dashboard settings: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# NEW ✱ Student / chat analytics helpers
# ─────────────────────────────────────────────────────────────────────────────

@server.tool()
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
    
    session = next(get_session())
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
        )

        # sort attempts by created_at
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

            # sort chats by created_at
            chats = session.exec(chats_stmt).all()
            chats = list(chats)
            chats = sorted(chats, key=lambda x: x.created_at)
            
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
                )
                
                # sort messages by created_at
                messages = session.exec(messages_stmt).all()
                messages = list(messages)
                messages = sorted(messages, key=lambda x: x.created_at)
                
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

@server.tool()
def find_profiles_by_name(name: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search for profiles by first name, last name, or alias using intelligent matching.
    
    This function helps users find profile IDs when they only know the person's name.
    It handles both single names and full names with smart matching logic:
    
    - Single name: searches across first_name, last_name, and alias fields
    - Full name: prioritizes exact first+last name combinations, with fallback to partial matches
    
    Parameters
    ----------
    name : str
        The name to search for (can be partial, single name, or full name)
    limit : int, optional
        Maximum number of results to return (default: 10)
    
    Returns
    -------
    List[Dict[str, Any]]
        List of matching profiles with basic info:
        - id: Profile UUID
        - first_name: First name
        - last_name: Last name  
        - alias: Alias/username
        - role: User role
        - full_name: Computed full name for display
    
    Examples
    --------
    find_profiles_by_name("jordan") -> finds "Jordan Lee", "Jordan Smith", etc.
    find_profiles_by_name("Nina Park") -> prioritizes exact "Nina Park" match, includes partial matches
    find_profiles_by_name("lee") -> finds "Jordan Lee", "Sarah Lee", etc.
    find_profiles_by_name("jlee") -> finds alias "jlee"
    """
    session = next(get_session())
    try:
        # Split the name to handle full names like "Nina Park"
        name_parts = name.strip().split()
        
        if len(name_parts) >= 2:
            # Handle full name: search for first_name AND last_name combination
            first_name_pattern = f"%{name_parts[0].lower()}%"
            last_name_pattern = f"%{name_parts[-1].lower()}%"
            
            # Primary search: exact first + last name match
            primary_conditions = and_(
                func.lower(Profiles.first_name).like(first_name_pattern),
                func.lower(Profiles.last_name).like(last_name_pattern)
            )
            
            # Fallback search: either part matches any field, or alias matches full name
            full_name_pattern = f"%{name.lower()}%"
            fallback_conditions = or_(
                func.lower(Profiles.first_name).like(first_name_pattern),
                func.lower(Profiles.last_name).like(last_name_pattern),
                func.lower(Profiles.alias).like(full_name_pattern)
            )
            
            # Combine with OR to get both exact matches and partial matches
            stmt = select(Profiles).where(
                or_(primary_conditions, fallback_conditions)
            ).limit(limit)
            
        else:
            # Single name: search across all fields as before
            search_pattern = f"%{name.lower()}%"
            stmt = select(Profiles).where(
                or_(
                    func.lower(Profiles.first_name).like(search_pattern),
                    func.lower(Profiles.last_name).like(search_pattern),
                    func.lower(Profiles.alias).like(search_pattern)
                )
            ).limit(limit)
        
        profiles = session.exec(stmt).all()
        
        results = []
        for profile in profiles:
            # Compute full name for display
            full_name_parts = []
            if profile.first_name:
                full_name_parts.append(profile.first_name)
            if profile.last_name:
                full_name_parts.append(profile.last_name)
            full_name = " ".join(full_name_parts) if full_name_parts else profile.alias or "Unknown"
            
            results.append({
                "id": str(profile.id),
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "alias": profile.alias,
                "role": profile.role,
                "full_name": full_name
            })
        
        return results
        
    except SQLAlchemyError as e:
        raise Exception(f"Database error searching profiles by name: {str(e)}")


@server.tool()
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
    
    session = next(get_session())
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
                cohort_uuid in Simulations.cohort_ids,
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


@server.tool()
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
    
    session = next(get_session())
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
        ).limit(limit)

        # sort attempts by created_at
        attempts = session.exec(attempts_stmt).all()
        attempts = list(attempts)
        attempts = sorted(attempts, key=lambda x: x.created_at)
        
        attempts_data = []
        
        for attempt in attempts:
            simulation = session.get(Simulations, attempt.simulation_id)
            if not simulation:
                continue
            
            # Get latest chat and grade for this attempt
            chat_stmt = select(SimulationChats).where(
                SimulationChats.attempt_id == attempt.id
            )
            
            # sort chats by created_at
            chats = session.exec(chat_stmt).all()
            chats = list(chats)
            chats = sorted(chats, key=lambda x: x.created_at)
            
            latest_chat = chats[0]
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


@server.tool()
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
    
    session = next(get_session())
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
            class_uuid in Profiles.class_ids
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


@server.tool()
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
    
    session = next(get_session())
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


@server.tool()
def search_by_scenario(scenario_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Detail a scenario:

    • Scenario record + linked class & agent  
    • SimulationChats counts  
    """
    try:
        scenario_uuid = uuid.UUID(scenario_id)
    except ValueError:
        raise ValueError(f"Invalid scenario_id format: {scenario_id}")
    
    session = next(get_session())
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

        
        return {
            "scenario": scenario_data,
            "class": class_data,
            "agent": agent_data,
            "usage_stats": {
                "simulation_chats": sim_chats_count,
            }
        }
        
    except SQLAlchemyError as e:
        raise Exception(f"Database error searching by scenario: {str(e)}")


@server.tool()
def search_by_agent(agent_id: str, limit: int = 100) -> Dict[str, Any]:
    """
    Agent dashboard:

    • Agent config (system_prompt, temperature)  
    • Scenarios powered by this agent  
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        raise ValueError(f"Invalid agent_id format: {agent_id}")
    
    session = next(get_session())
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
        
        return {
            "agent": agent_data,
            "model": model_data,
            "scenarios": scenarios_data,
        }
        
    except SQLAlchemyError as e:
        raise Exception(f"Database error searching by agent: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Utilities (optional): row-limit decorator, JSON serialiser helpers, etc.
# ─────────────────────────────────────────────────────────────────────────────

@server.tool()
def cohort_overview(cohort_id: str) -> Dict[str, Any]:
    """
    🔎 Cohort overview
    ------------------
    Cohort meta, roster, active sims, pass-rate.
    
    Input
      • cohort_id – UUID of the cohort
    
    Returns
      { "cohort": { … }, "roster": [ … ], "simulations": [ … ], "stats": { … } }
    
    Quick-start
      ask:  "How's Fall 2025 Cohort A doing?"
      call: cohort_overview("uuid-here")
    
    See also 👉 cohort_pass_matrix() for detailed pass/fail data.
    """
    try:
        cohort_uuid = uuid.UUID(cohort_id)
    except ValueError:
        return {"error": f"Invalid cohort_id format: {cohort_id}"}
    
    session = next(get_session())
    try:
        # Get cohort
        cohort = session.get(Cohorts, cohort_uuid)
        if not cohort:
            return {"error": f"Cohort not found: {cohort_id}"}
        
        cohort_data = {
            "id": str(cohort.id),
            "title": cohort.title,
            "description": cohort.description,
            "active": cohort.active,
            "created_at": cohort.created_at.isoformat()
        }
        
        # Get roster
        roster = []
        if cohort.profile_ids:
            profiles_stmt = select(Profiles).where(Profiles.id.in_(cohort.profile_ids))
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
        
        # Get simulations
        simulations_stmt = select(Simulations).where(
            and_(
                cohort_uuid.in_(Simulations.cohort_ids),
                Simulations.active == True
            )
        )
        simulations = session.exec(simulations_stmt).all()
        
        simulations_data = [
            {
                "id": str(sim.id),
                "title": sim.title,
                "active": sim.active,
                "time_limit": sim.time_limit
            }
            for sim in simulations
        ]
        
        # Calculate basic stats
        total_students = len(roster)
        active_simulations = len(simulations_data)
        
        return {
            "cohort": cohort_data,
            "roster": roster,
            "simulations": simulations_data,
            "stats": {
                "total_students": total_students,
                "active_simulations": active_simulations
            }
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}

@server.tool()
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

@server.tool()
def scenario_overview(scenario_id: str) -> Dict[str, Any]:
    """
    🔎 Scenario overview
    --------------------
    Scenario details, linked class & agent, usage count.
    
    Input
      • scenario_id – UUID of the scenario
    
    Returns
      { "scenario": { … }, "class": { … }, "agent": { … }, "usage": { … } }
    
    Quick-start
      ask:  "Details for the Sepsis scenario"
      call: scenario_overview("uuid-here")
    
    See also 👉 agent_overview() for agent details.
    """
    try:
        scenario_uuid = uuid.UUID(scenario_id)
    except ValueError:
        return {"error": f"Invalid scenario_id format: {scenario_id}"}
    
    session = next(get_session())
    try:
        # Get scenario
        scenario = session.get(Scenarios, scenario_uuid)
        if not scenario:
            return {"error": f"Scenario not found: {scenario_id}"}
        
        scenario_data = {
            "id": str(scenario.id),
            "name": scenario.name,
            "description": scenario.description,
            "default_scenario": scenario.default_scenario,
            "crowdedness": scenario.crowdedness,
            "intensity": scenario.intensity,
            "seniority": scenario.seniority,
            "created_at": scenario.created_at.isoformat()
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
        
        # Count usage
        sim_chats_stmt = select(func.count(SimulationChats.id)).where(
            SimulationChats.scenario_id == scenario_uuid
        )
        sim_chats_count = session.exec(sim_chats_stmt).one()
        
        return {
            "scenario": scenario_data,
            "class": class_data,
            "agent": agent_data,
            "usage": {
                "simulation_chats": sim_chats_count
            }
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}

@server.tool()
def agent_overview(agent_id: str) -> Dict[str, Any]:
    """
    🔎 Agent overview
    -----------------
    Agent settings + which scenarios use it.
    
    Input
      • agent_id – UUID of the agent
    
    Returns
      { "agent": { … }, "model": { … }, "scenarios": [ … ] }
    
    Quick-start
      ask:  "What's the prompt for Agent 'Socrates'?"
      call: agent_overview("uuid-here")
    
    See also 👉 agent_response_times() for performance metrics.
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        return {"error": f"Invalid agent_id format: {agent_id}"}
    
    session = next(get_session())
    try:
        # Get agent
        agent = session.get(Agents, agent_uuid)
        if not agent:
            return {"error": f"Agent not found: {agent_id}"}
        
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
        if agent.model_id:
            model = session.get(Models, agent.model_id)
            if model:
                model_data = {
                    "id": str(model.id),
                    "name": model.name,
                    "description": model.description
                }
        
        # Get scenarios
        scenarios_stmt = select(Scenarios).where(Scenarios.agent_id == agent_uuid)
        scenarios = session.exec(scenarios_stmt).all()
        
        scenarios_data = [
            {
                "id": str(scenario.id),
                "name": scenario.name,
                "description": scenario.description
            }
            for scenario in scenarios
        ]
        
        return {
            "agent": agent_data,
            "model": model_data,
            "scenarios": scenarios_data
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}

# ─────────────────────────────────────────────────────────────────────────────
# ✱ Search / Helper Tools (9-11)
# ─────────────────────────────────────────────────────────────────────────────

@server.tool()
def find_profiles(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find profiles by name
    ------------------------
    Fuzzy first/last/alias search.
    
    Input
      • query – Name or alias to search for
      • limit – Max results (default: 10)
    
    Returns
      [ { "id": "…", "full_name": "…", … }, … ]
    
    Quick-start
      ask:  "Find everyone named Jordan"
      call: find_profiles("Jordan")
    
    See also 👉 profile_overview() for detailed profile data.
    """
    session = next(get_session())
    try:
        # Split the query to handle full names
        query_parts = query.strip().split()
        
        if len(query_parts) >= 2:
            # Handle full name
            first_pattern = f"%{query_parts[0].lower()}%"
            last_pattern = f"%{query_parts[-1].lower()}%"
            
            primary_conditions = and_(
                func.lower(Profiles.first_name).like(first_pattern),
                func.lower(Profiles.last_name).like(last_pattern)
            )
            
            full_pattern = f"%{query.lower()}%"
            fallback_conditions = or_(
                func.lower(Profiles.first_name).like(first_pattern),
                func.lower(Profiles.last_name).like(last_pattern),
                func.lower(Profiles.alias).like(full_pattern)
            )
            
            stmt = select(Profiles).where(
                or_(primary_conditions, fallback_conditions)
            ).limit(limit)
        else:
            # Single name search
            search_pattern = f"%{query.lower()}%"
            stmt = select(Profiles).where(
                or_(
                    func.lower(Profiles.first_name).like(search_pattern),
                    func.lower(Profiles.last_name).like(search_pattern),
                    func.lower(Profiles.alias).like(search_pattern)
                )
            ).limit(limit)
        
        profiles = session.exec(stmt).all()
        
        results = []
        for profile in profiles:
            full_name_parts = []
            if profile.first_name:
                full_name_parts.append(profile.first_name)
            if profile.last_name:
                full_name_parts.append(profile.last_name)
            full_name = " ".join(full_name_parts) if full_name_parts else profile.alias or "Unknown"
            
            results.append({
                "id": str(profile.id),
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "alias": profile.alias,
                "role": profile.role,
                "full_name": full_name
            })
        
        return results
        
    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]

@server.tool()
def find_classes(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find classes by name/code
    ----------------------------
    Fuzzy class code/name search.
    
    Input
      • query – Class code or name to search for
      • limit – Max results (default: 10)
    
    Returns
      [ { "id": "…", "class_code": "…", "name": "…", … }, … ]
    
    Quick-start
      ask:  "Search for 'BIOL-1102'"
      call: find_classes("BIOL-1102")
    
    See also 👉 class_overview() for detailed class data.
    """
    session = next(get_session())
    try:
        search_pattern = f"%{query.lower()}%"
        stmt = select(Classes).where(
            or_(
                func.lower(Classes.class_code).like(search_pattern),
                func.lower(Classes.name).like(search_pattern)
            )
        ).limit(limit)
        
        classes = session.exec(stmt).all()
        
        results = [
            {
                "id": str(cls.id),
                "class_code": cls.class_code,
                "name": cls.name,
                "year": cls.year,
                "term": cls.term,
                "description": cls.description
            }
            for cls in classes
        ]
        
        return results
        
    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]

@server.tool()
def find_simulations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find simulations by title
    ----------------------------
    Fuzzy sim title search.
    
    Input
      • query – Simulation title to search for
      • limit – Max results (default: 10)
    
    Returns
      [ { "id": "…", "title": "…", "active": true, … }, … ]
    
    Quick-start
      ask:  "Which sims mention 'cardiac'?"
      call: find_simulations("cardiac")
    
    See also 👉 simulation_overview() for detailed sim data.
    """
    session = next(get_session())
    try:
        search_pattern = f"%{query.lower()}%"
        stmt = select(Simulations).where(
            func.lower(Simulations.title).like(search_pattern)
        ).limit(limit)
        
        simulations = session.exec(stmt).all()
        
        results = [
            {
                "id": str(sim.id),
                "title": sim.title,
                "active": sim.active,
                "time_limit": sim.time_limit,
                "created_at": sim.created_at.isoformat()
            }
            for sim in simulations
        ]
        
        return results
        
    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
