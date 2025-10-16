# student_sim_report.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from typing import Any, Dict, List

import asyncpg  # type: ignore


async def student_sim_report(conn: asyncpg.Connection, profile_id: str, recent: int = 50) -> Dict[str, Any]:
    """
    Deep dive: every attempt, chat, grade, feedback
    Comprehensive student simulation report.

    Input
      • conn - Database connection from asyncpg
      • profile_id - UUID of the student profile
      • recent - Limit messages per chat (default: 50)

    Returns
      { "profile": { … }, "attempts": [ … ] }

    Quick-start
      ask:  "Full report on student X"
      call: student_sim_report(conn, "uuid-here")

    See also profile_overview() for summary view.
    """
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        return {"error": f"Invalid profile_id format: {profile_id}"}

    try:
        # Get profile
        profile = await conn.fetchrow(
            """
            SELECT id, first_name, last_name, alias, role, created_at
            FROM profiles
            WHERE id = $1
            """,
            profile_uuid,
        )
        if not profile:
            return {"error": f"Profile not found: {profile_id}"}

        profile_data = {
            "id": str(profile["id"]),
            "first_name": profile["first_name"],
            "last_name": profile["last_name"],
            "alias": profile["alias"],
            "role": profile["role"],
            "created_at": profile["created_at"].isoformat() if profile["created_at"] else None,
        }

        # Get all attempts with their chats, grades, and feedback in one query
        attempts_raw = await conn.fetch(
            """
            SELECT 
                sa.id as attempt_id,
                sa.created_at as attempt_created_at,
                s.id as simulation_id,
                s.title as simulation_title,
                sc.id as chat_id,
                sc.title as chat_title,
                sc.completed as chat_completed,
                sc.completed_at as chat_completed_at,
                sc.created_at as chat_created_at,
                scn.id as scenario_id,
                scn.name as scenario_name,
                scn.problem_statement as scenario_description,
                scg.id as grade_id,
                scg.score,
                scg.passed,
                scg.time_taken,
                scg.created_at as grade_created_at
            FROM simulation_attempts sa
            JOIN attempt_profiles ap ON sa.id = ap.attempt_id
            JOIN simulations s ON s.id = sa.simulation_id
            LEFT JOIN simulation_chats sc ON sc.attempt_id = sa.id
            LEFT JOIN scenarios scn ON scn.id = sc.scenario_id
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            WHERE ap.profile_id = $1 AND ap.active = true
            ORDER BY sa.created_at, sc.created_at
            """,
            profile_uuid,
        )

        # Group attempts by attempt_id and chat_id
        attempts_dict: Dict[str, Dict[str, Any]] = {}
        
        for row in attempts_raw:
            attempt_id = str(row["attempt_id"])
            chat_id = str(row["chat_id"]) if row["chat_id"] else None
            
            if attempt_id not in attempts_dict:
                attempts_dict[attempt_id] = {
                    "simulation_id": str(row["simulation_id"]),
                    "title": row["simulation_title"],
                    "chats": {}
                }
            
            if chat_id and chat_id not in attempts_dict[attempt_id]["chats"]:
                attempts_dict[attempt_id]["chats"][chat_id] = {
                    "id": chat_id,
                    "title": row["chat_title"],
                    "completed": row["chat_completed"],
                    "completed_at": row["chat_completed_at"].isoformat() if row["chat_completed_at"] else None,
                    "scenario": {
                        "id": str(row["scenario_id"]) if row["scenario_id"] else None,
                        "name": row["scenario_name"],
                        "description": row["scenario_description"],
                    } if row["scenario_id"] else {},
                    "grade": {
                        "score": row["score"],
                        "passed": row["passed"],
                        "time_taken": row["time_taken"],
                        "created_at": row["grade_created_at"].isoformat() if row["grade_created_at"] else None,
                    } if row["grade_id"] else {},
                    "messages": [],
                    "feedback": [],
                    "grade_id": row["grade_id"]
                }

        # Get messages for all chats
        chat_ids = []
        for attempt in attempts_dict.values():
            chat_ids.extend(attempt["chats"].keys())
        
        if chat_ids:
            # Convert string UUIDs back to UUID type for query
            chat_uuids = [uuid.UUID(cid) for cid in chat_ids]
            messages = await conn.fetch(
                """
                SELECT 
                    chat_id,
                    created_at,
                    type,
                    content,
                    completed
                FROM simulation_messages
                WHERE chat_id = ANY($1)
                ORDER BY chat_id, created_at
                """,
                chat_uuids,
            )
            
            # Group messages by chat_id
            messages_by_chat: Dict[str, List[Dict[str, Any]]] = {}
            for msg in messages:
                chat_id_str = str(msg["chat_id"])
                if chat_id_str not in messages_by_chat:
                    messages_by_chat[chat_id_str] = []
                messages_by_chat[chat_id_str].append({
                    "created_at": msg["created_at"].isoformat() if msg["created_at"] else None,
                    "type": msg["type"],
                    "content": msg["content"],
                    "completed": msg["completed"],
                })
            
            # Add messages to chats (limit to recent)
            for attempt in attempts_dict.values():
                for chat_id, chat_data in attempt["chats"].items():
                    if chat_id in messages_by_chat:
                        all_messages = messages_by_chat[chat_id]
                        if len(all_messages) > recent:
                            chat_data["messages"] = all_messages[-recent:]
                        else:
                            chat_data["messages"] = all_messages

        # Get feedback for all grades
        grade_ids = []
        for attempt in attempts_dict.values():
            for chat_data in attempt["chats"].values():
                if chat_data.get("grade_id"):
                    grade_ids.append(chat_data["grade_id"])
        
        if grade_ids:
            feedback = await conn.fetch(
                """
                SELECT 
                    scf.simulation_chat_grade_id,
                    st.name as standard_name,
                    scf.total as points,
                    scf.feedback
                FROM simulation_chat_feedbacks scf
                JOIN standards st ON st.id = scf.standard_id
                WHERE scf.simulation_chat_grade_id = ANY($1)
                ORDER BY scf.simulation_chat_grade_id
                """,
                grade_ids,
            )
            
            # Group feedback by grade_id
            feedback_by_grade: Dict[str, List[Dict[str, Any]]] = {}
            for fb in feedback:
                grade_id = fb["simulation_chat_grade_id"]
                if grade_id not in feedback_by_grade:
                    feedback_by_grade[grade_id] = []
                feedback_by_grade[grade_id].append({
                    "standard": fb["standard_name"],
                    "points": fb["points"],
                    "feedback": fb["feedback"],
                })
            
            # Add feedback to chats
            for attempt in attempts_dict.values():
                for chat_data in attempt["chats"].values():
                    if chat_data.get("grade_id") and chat_data["grade_id"] in feedback_by_grade:
                        chat_data["feedback"] = feedback_by_grade[chat_data["grade_id"]]
                    # Remove grade_id from output
                    if "grade_id" in chat_data:
                        del chat_data["grade_id"]

        # Convert to list format
        attempts_data = []
        for attempt_data in attempts_dict.values():
            for chat_data in attempt_data["chats"].values():
                attempts_data.append({
                    "simulation_id": attempt_data["simulation_id"],
                    "title": attempt_data["title"],
                    "scenario": chat_data["scenario"],
                    "chat": {
                        "id": chat_data["id"],
                        "title": chat_data["title"],
                        "completed": chat_data["completed"],
                        "completed_at": chat_data["completed_at"],
                        "messages": chat_data["messages"],
                        "grade": chat_data["grade"],
                        "feedback": chat_data["feedback"],
                    }
                })

        return {"profile": profile_data, "attempts": attempts_data}

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
