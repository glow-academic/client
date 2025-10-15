"""Simulation queries - SQL query builders."""

from typing import Any, Dict, List, Tuple


class SimulationQueries:
    """Query builders for simulation operations."""

    def list_simulations(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for simulations list with permissions."""
        query = """
        WITH simulation_scenarios AS (
            SELECT 
                ss.simulation_id,
                ARRAY_AGG(ss.scenario_id ORDER BY sc.name) as scenario_ids,
                COUNT(ss.scenario_id) as num_scenarios
            FROM simulation_scenarios ss
            JOIN scenarios sc ON sc.id = ss.scenario_id
            WHERE ss.active = true
            GROUP BY ss.simulation_id
        ),
        simulation_attempts AS (
            SELECT 
                sa.simulation_id,
                COUNT(*) as attempt_count
            FROM simulation_attempts sa
            GROUP BY sa.simulation_id
        ),
        simulation_data AS (
            SELECT 
                s.id as simulation_id,
                s.title as name,
                s.description,
                s.time_limit,
                s.active,
                s.default_simulation,
                s.practice_simulation,
                s.rubric_id,
                COALESCE(ss.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(ss.num_scenarios, 0) as num_scenarios,
                COALESCE(sa.attempt_count, 0) as attempt_count
            FROM simulations s
            LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
            LEFT JOIN simulation_attempts sa ON sa.simulation_id = s.id
            WHERE s.department_id = ANY(:department_ids)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            sd.*,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') AND sd.attempt_count = 0 THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate
        FROM simulation_data sd
        CROSS JOIN user_profile up
        ORDER BY sd.name
        """

        params = {"department_ids": department_ids, "profile_id": profile_id}
        return (query, params)

    def get_scenario_mapping(
        self, scenario_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for scenario mapping."""
        query = "SELECT id, name, problem_statement FROM scenarios WHERE id = ANY(:scenario_ids)"
        params = {"scenario_ids": scenario_ids}
        return (query, params)

    def get_rubric_mapping(
        self, rubric_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for rubric mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description FROM rubrics WHERE id = ANY(:rubric_ids)"
        params = {"rubric_ids": rubric_ids}
        return (query, params)

    def get_simulation_by_id(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get simulation by ID."""
        query = """
        SELECT 
            title,
            description,
            department_id,
            active,
            default_simulation,
            practice_simulation,
            hints_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            time_limit,
            rubric_id
        FROM simulations
        WHERE id = :simulation_id
        """
        params = {"simulation_id": simulation_id}
        return (query, params)

    def get_simulation_scenarios(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get simulation's scenarios."""
        query = """
        SELECT scenario_id FROM simulation_scenarios 
        WHERE simulation_id = :simulation_id AND active = true
        """
        params = {"simulation_id": simulation_id}
        return (query, params)

    def get_valid_scenarios(
        self, dept_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid scenarios."""
        query = """
        SELECT id FROM scenarios 
        WHERE department_id = ANY(:dept_ids) AND active = true
        ORDER BY name
        """
        params = {"dept_ids": dept_ids}
        return (query, params)

    def get_valid_rubrics(
        self, dept_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid rubrics."""
        query = """
        SELECT id, name, COALESCE(description, '') as description FROM rubrics 
        WHERE department_id = ANY(:dept_ids) AND active = true
        ORDER BY name
        """
        params = {"dept_ids": dept_ids}
        return (query, params)

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = :profile_id AND d.active = true
        ORDER BY d.title
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def get_default_simulation(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for default simulation."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = :profile_id
        ),
        user_simulations AS (
            SELECT s.*
            FROM simulations s
            JOIN user_departments ud ON ud.department_id = s.department_id
            WHERE s.active = true
            ORDER BY s.default_simulation ASC, s.created_at DESC
            LIMIT 1
        )
        SELECT id
        FROM user_simulations
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def create_simulation(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create simulation."""
        query = """
        INSERT INTO simulations (
            title,
            description,
            department_id,
            active,
            default_simulation,
            practice_simulation,
            hints_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            time_limit,
            rubric_id
        )
        VALUES (
            :title,
            :description,
            :department_id,
            :active,
            :default_simulation,
            :practice_simulation,
            :hints_enabled,
            :input_guardrail_active,
            :output_guardrail_active,
            :image_input_active,
            :time_limit,
            :rubric_id
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def insert_simulation_scenario(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert simulation scenario."""
        query = """
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active)
        VALUES (:simulation_id, :scenario_id, true)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_simulation_name(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get simulation name."""
        query = "SELECT title FROM simulations WHERE id = :simulation_id"
        params = {"simulation_id": simulation_id}
        return (query, params)

    def update_simulation(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update simulation."""
        query = """
        UPDATE simulations SET
            title = :title,
            description = :description,
            department_id = :department_id,
            active = :active,
            default_simulation = :default_simulation,
            practice_simulation = :practice_simulation,
            hints_enabled = :hints_enabled,
            input_guardrail_active = :input_guardrail_active,
            output_guardrail_active = :output_guardrail_active,
            image_input_active = :image_input_active,
            time_limit = :time_limit,
            rubric_id = :rubric_id,
            updated_at = NOW()
        WHERE id = :simulation_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def delete_simulation_scenarios(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete simulation scenarios."""
        query = """
        DELETE FROM simulation_scenarios WHERE simulation_id = :simulation_id
        """
        params = {"simulation_id": simulation_id}
        return (query, params)

    def get_simulation_for_duplicate(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get simulation data for duplication."""
        query = """
        SELECT 
            title,
            description,
            department_id,
            hints_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            time_limit,
            rubric_id
        FROM simulations
        WHERE id = :simulation_id
        """
        params = {"simulation_id": simulation_id}
        return (query, params)

    def insert_duplicate_simulation(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert duplicate simulation."""
        query = """
        INSERT INTO simulations (
            title,
            description,
            department_id,
            active,
            default_simulation,
            practice_simulation,
            hints_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            time_limit,
            rubric_id
        )
        VALUES (
            :title || ' Copy',
            :description,
            :department_id,
            false,
            false,
            false,
            :hints_enabled,
            :input_guardrail_active,
            :output_guardrail_active,
            :image_input_active,
            :time_limit,
            :rubric_id
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def copy_simulation_scenarios(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to copy simulation scenarios."""
        query = """
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active)
        SELECT :new_simulation_id, scenario_id, active
        FROM simulation_scenarios
        WHERE simulation_id = :original_simulation_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def check_simulation_usage(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check simulation usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulation_attempts
        WHERE simulation_id = :simulation_id
        """
        params = {"simulation_id": simulation_id}
        return (query, params)

    def delete_simulation(
        self, simulation_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete simulation."""
        query = "DELETE FROM simulations WHERE id = :simulation_id"
        params = {"simulation_id": simulation_id}
        return (query, params)


def get_attempt_full_data(db: Any, attempt_id: Any) -> dict[str, Any]:
    """Get complete attempt data with all related entities and computed values."""
    from datetime import datetime, timezone
    from typing import Any, Dict, List
    from uuid import UUID

    from sqlalchemy import text

    # Convert attempt_id to string for SQL
    attempt_id_str = str(attempt_id)
    
    # 1. Get attempt and simulation
    attempt_query = text("""
        SELECT 
            sa.id,
            sa.created_at,
            sa.simulation_id,
            sa.infinite_mode,
            sa.infinite_mode_time_limit,
            sa.archived,
            s.id as sim_id,
            s.title as sim_title,
            s.description as sim_description,
            s.department_id as sim_department_id,
            s.active as sim_active,
            s.default_simulation as sim_default_simulation,
            s.practice_simulation as sim_practice_simulation,
            s.hints_enabled as sim_hints_enabled,
            s.input_guardrail_active as sim_input_guardrail_active,
            s.output_guardrail_active as sim_output_guardrail_active,
            s.image_input_active as sim_image_input_active,
            s.time_limit as sim_time_limit,
            s.rubric_id as sim_rubric_id,
            s.created_at as sim_created_at,
            s.updated_at as sim_updated_at
        FROM simulation_attempts sa
        JOIN simulations s ON s.id = sa.simulation_id
        WHERE sa.id = :attempt_id
    """)
    
    attempt_result = db.execute(attempt_query, {"attempt_id": attempt_id_str}).fetchone()
    if not attempt_result:
        raise ValueError(f"Attempt {attempt_id} not found")
    
    attempt = {
        "id": str(attempt_result.id),
        "createdAt": attempt_result.created_at.isoformat(),
        "simulationId": str(attempt_result.simulation_id),
        "infiniteMode": attempt_result.infinite_mode,
        "infiniteModeTimeLimit": attempt_result.infinite_mode_time_limit,
        "archived": attempt_result.archived,
    }
    
    simulation = {
        "id": str(attempt_result.sim_id),
        "title": attempt_result.sim_title,
        "description": attempt_result.sim_description,
        "departmentId": str(attempt_result.sim_department_id),
        "active": attempt_result.sim_active,
        "defaultSimulation": attempt_result.sim_default_simulation,
        "practiceSimulation": attempt_result.sim_practice_simulation,
        "hintsEnabled": attempt_result.sim_hints_enabled,
        "inputGuardrailActive": attempt_result.sim_input_guardrail_active,
        "outputGuardrailActive": attempt_result.sim_output_guardrail_active,
        "imageInputActive": attempt_result.sim_image_input_active,
        "timeLimit": attempt_result.sim_time_limit,
        "rubricId": str(attempt_result.sim_rubric_id) if attempt_result.sim_rubric_id else None,
        "createdAt": attempt_result.sim_created_at.isoformat(),
        "updatedAt": attempt_result.sim_updated_at.isoformat(),
    }
    
    # 2. Get attempt profiles
    attempt_profiles_query = text("""
        SELECT profile_id, attempt_id, active
        FROM attempt_profiles
        WHERE attempt_id = :attempt_id
    """)
    
    attempt_profiles_result = db.execute(attempt_profiles_query, {"attempt_id": attempt_id_str}).fetchall()
    attempt_profiles = [
        {
            "profileId": str(row.profile_id),
            "attemptId": str(row.attempt_id),
            "active": row.active,
        }
        for row in attempt_profiles_result
    ]
    
    # 3. Get all chats for this attempt
    chats_query = text("""
        SELECT 
            sc.id,
            sc.created_at,
            sc.updated_at,
            sc.title,
            sc.scenario_id,
            sc.attempt_id,
            sc.completed,
            sc.completed_at,
            sc.trace_id
        FROM simulation_chats sc
        WHERE sc.attempt_id = :attempt_id
        ORDER BY sc.created_at
    """)
    
    chats_result = db.execute(chats_query, {"attempt_id": attempt_id_str}).fetchall()
    chat_ids = [str(row.id) for row in chats_result]
    scenario_ids = list(set([str(row.scenario_id) for row in chats_result]))
    
    # 4. Get all scenarios
    scenarios = {}
    if scenario_ids:
        scenarios_query = text("""
            SELECT 
                id,
                name,
                problem_statement,
                department_id,
                active,
                persona_id,
                created_at,
                updated_at,
                generated,
                default_scenario
            FROM scenarios
            WHERE id = ANY(:scenario_ids)
        """)
        
        scenarios_result = db.execute(scenarios_query, {"scenario_ids": scenario_ids}).fetchall()
        scenarios = {
            str(row.id): {
                "id": str(row.id),
                "name": row.name,
                "problemStatement": row.problem_statement,
                "departmentId": str(row.department_id),
                "active": row.active,
                "personaId": str(row.persona_id) if row.persona_id else None,
                "createdAt": row.created_at.isoformat(),
                "updatedAt": row.updated_at.isoformat(),
                "generated": row.generated,
                "defaultScenario": row.default_scenario,
            }
            for row in scenarios_result
        }
    
    # 5. Get all messages for all chats
    messages_by_chat: Dict[str, List[Dict[str, Any]]] = {}
    if chat_ids:
        messages_query = text("""
            SELECT 
                id,
                created_at,
                updated_at,
                chat_id,
                content,
                type,
                completed
            FROM simulation_messages
            WHERE chat_id = ANY(:chat_ids)
            ORDER BY created_at
        """)
        
        messages_result = db.execute(messages_query, {"chat_ids": chat_ids}).fetchall()
        for row in messages_result:
            chat_id = str(row.chat_id)
            if chat_id not in messages_by_chat:
                messages_by_chat[chat_id] = []
            messages_by_chat[chat_id].append({
                "id": str(row.id),
                "createdAt": row.created_at.isoformat(),
                "updatedAt": row.updated_at.isoformat(),
                "chatId": chat_id,
                "content": row.content,
                "type": row.type,
                "completed": row.completed,
            })
    
    # 6. Get all hints for practice simulations
    hints_by_message: Dict[str, List[Dict[str, Any]]] = {}
    if simulation["practiceSimulation"] and messages_by_chat:
        all_message_ids = []
        for messages in messages_by_chat.values():
            all_message_ids.extend([msg["id"] for msg in messages if msg["type"] == "response"])
        
        if all_message_ids:
            hints_query = text("""
                SELECT 
                    id,
                    simulation_message_id,
                    hint,
                    created_at
                FROM simulation_hints
                WHERE simulation_message_id = ANY(:message_ids)
                ORDER BY created_at
            """)
            
            hints_result = db.execute(hints_query, {"message_ids": all_message_ids}).fetchall()
            for row in hints_result:
                message_id = str(row.simulation_message_id)
                if message_id not in hints_by_message:
                    hints_by_message[message_id] = []
                hints_by_message[message_id].append({
                    "id": str(row.id),
                    "simulationMessageId": message_id,
                    "hint": row.hint,
                    "createdAt": row.created_at.isoformat(),
                })
    
    # 7. Get grades and feedbacks
    grades_by_chat: Dict[str, Dict[str, Any]] = {}
    feedbacks_by_grade: Dict[str, List[Dict[str, Any]]] = {}
    if chat_ids:
        grades_query = text("""
            SELECT 
                id,
                created_at,
                simulation_chat_id,
                rubric_id,
                description,
                passed,
                score,
                time_taken
            FROM simulation_chat_grades
            WHERE simulation_chat_id = ANY(:chat_ids)
        """)
        
        grades_result = db.execute(grades_query, {"chat_ids": chat_ids}).fetchall()
        grade_ids = []
        for row in grades_result:
            chat_id = str(row.simulation_chat_id)
            grade_id = str(row.id)
            grade_ids.append(grade_id)
            grades_by_chat[chat_id] = {
                "id": grade_id,
                "createdAt": row.created_at.isoformat(),
                "simulationChatId": chat_id,
                "rubricId": str(row.rubric_id),
                "description": row.description,
                "passed": row.passed,
                "score": row.score,
                "timeTaken": row.time_taken,
            }
        
        # Get feedbacks
        if grade_ids:
            feedbacks_query = text("""
                SELECT 
                    id,
                    created_at,
                    standard_id,
                    simulation_chat_grade_id,
                    total,
                    feedback
                FROM simulation_chat_feedbacks
                WHERE simulation_chat_grade_id = ANY(:grade_ids)
            """)
            
            feedbacks_result = db.execute(feedbacks_query, {"grade_ids": grade_ids}).fetchall()
            for row in feedbacks_result:
                grade_id = str(row.simulation_chat_grade_id)
                if grade_id not in feedbacks_by_grade:
                    feedbacks_by_grade[grade_id] = []
                feedbacks_by_grade[grade_id].append({
                    "id": str(row.id),
                    "createdAt": row.created_at.isoformat(),
                    "standardId": str(row.standard_id),
                    "simulationChatGradeId": grade_id,
                    "total": row.total,
                    "feedback": row.feedback,
                })
    
    # 8. Get rubric structure (standard groups and standards)
    standard_groups: Dict[str, Dict[str, Any]] = {}
    standards_by_group: Dict[str, List[Dict[str, Any]]] = {}
    if simulation["rubricId"]:
        # Get standard groups
        groups_query = text("""
            SELECT 
                id,
                name,
                short_name,
                points,
                rubric_id
            FROM standard_groups
            WHERE rubric_id = :rubric_id
        """)
        
        groups_result = db.execute(groups_query, {"rubric_id": simulation["rubricId"]}).fetchall()
        group_ids = []
        for row in groups_result:
            group_id = str(row.id)
            group_ids.append(group_id)
            standard_groups[group_id] = {
                "id": group_id,
                "name": row.name,
                "shortName": row.short_name,
                "points": row.points,
                "rubricId": str(row.rubric_id),
            }
        
        # Get standards
        if group_ids:
            standards_query = text("""
                SELECT 
                    id,
                    name,
                    points,
                    standard_group_id
                FROM standards
                WHERE standard_group_id = ANY(:group_ids)
            """)
            
            standards_result = db.execute(standards_query, {"group_ids": group_ids}).fetchall()
            for row in standards_result:
                group_id = str(row.standard_group_id)
                if group_id not in standards_by_group:
                    standards_by_group[group_id] = []
                standards_by_group[group_id].append({
                    "id": str(row.id),
                    "name": row.name,
                    "points": row.points,
                    "standardGroupId": group_id,
                })
    
    # 9. Get documents
    # Get unique department IDs from scenarios
    dept_ids = list(set([scenarios[sid]["departmentId"] for sid in scenario_ids if sid in scenarios]))
    
    department_documents = []
    scenario_documents = []
    if dept_ids:
        # Get all department documents
        dept_docs_query = text("""
            SELECT 
                id,
                name,
                file_path,
                type,
                classified,
                file_id,
                mime_type,
                department_id,
                active,
                created_at,
                updated_at
            FROM documents
            WHERE department_id = ANY(:dept_ids) AND active = true
        """)
        
        dept_docs_result = db.execute(dept_docs_query, {"dept_ids": dept_ids}).fetchall()
        department_documents = [
            {
                "id": str(row.id),
                "name": row.name,
                "title": row.name,  # Use name as title
                "description": "",  # Documents don't have description in schema
                "filePath": row.file_path,
                "type": row.type,
                "classified": row.classified,
                "fileId": str(row.file_id) if row.file_id else None,
                "mimeType": row.mime_type,
                "departmentId": str(row.department_id),
                "fileSize": 0,  # Not in schema, default to 0
                "active": row.active,
                "createdAt": row.created_at.isoformat(),
                "updatedAt": row.updated_at.isoformat(),
            }
            for row in dept_docs_result
        ]
        
        # Get scenario-specific documents
        if scenario_ids:
            scenario_docs_query = text("""
                SELECT DISTINCT d.id,
                    d.name,
                    d.file_path,
                    d.type,
                    d.classified,
                    d.file_id,
                    d.mime_type,
                    d.department_id,
                    d.active,
                    d.created_at,
                    d.updated_at
                FROM documents d
                JOIN scenario_documents sd ON sd.document_id = d.id
                WHERE sd.scenario_id = ANY(:scenario_ids) AND d.active = true
            """)
            
            scenario_docs_result = db.execute(scenario_docs_query, {"scenario_ids": scenario_ids}).fetchall()
            scenario_documents = [
                {
                    "id": str(row.id),
                    "name": row.name,
                    "title": row.name,  # Use name as title
                    "description": "",  # Documents don't have description in schema
                    "filePath": row.file_path,
                    "type": row.type,
                    "classified": row.classified,
                    "fileId": str(row.file_id) if row.file_id else None,
                    "mimeType": row.mime_type,
                    "departmentId": str(row.department_id),
                    "fileSize": 0,  # Not in schema, default to 0
                    "active": row.active,
                    "createdAt": row.created_at.isoformat(),
                    "updatedAt": row.updated_at.isoformat(),
                }
                for row in scenario_docs_result
            ]
    
    # 10. Compute dynamic rubrics for each chat
    def compute_dynamic_rubric(chat_id: str, grade: Dict[str, Any] | None, feedbacks: List[Dict[str, Any]]) -> Dict[str, Any] | None:
        """Compute dynamic rubric for a chat."""
        if not grade or not standard_groups:
            return None
        
        skill_scores = {}
        skill_feedbacks = {}
        total_possible_points = 0
        
        # Group feedbacks by standard group
        for group_id, group in standard_groups.items():
            group_standards = standards_by_group.get(group_id, [])
            if not group_standards:
                continue
            
            # Filter feedbacks for this group
            group_feedback_list = [
                f for f in feedbacks
                if any(std["id"] == f["standardId"] for std in group_standards)  # type: ignore
            ]
            
            if group_feedback_list:
                group_max_points = group["points"]  # type: ignore
                max_standard_points = max(std["points"] for std in group_standards)  # type: ignore
                avg_score = sum(f["total"] for f in group_feedback_list) / len(group_feedback_list)  # type: ignore
                normalized_score = round((avg_score / max_standard_points) * 5)
                
                skill_scores[group["name"]] = normalized_score  # type: ignore
                skill_feedbacks[group["shortName"]] = "; ".join(f["feedback"] or "" for f in group_feedback_list)  # type: ignore
                total_possible_points += group_max_points
        
        return {
            "chatId": chat_id,
            "score": grade["score"],  # type: ignore
            "passed": grade["passed"],  # type: ignore
            "timeTaken": grade["timeTaken"],  # type: ignore
            "skillScores": skill_scores,
            "skillFeedbacks": skill_feedbacks,
            "totalPossiblePoints": total_possible_points,
        }
    
    # 11. Build chat objects with all nested data
    chats = []
    for chat_row in chats_result:
        chat_id = str(chat_row.id)
        scenario_id = str(chat_row.scenario_id)
        
        grade = grades_by_chat.get(chat_id)
        feedbacks = feedbacks_by_grade.get(grade["id"], []) if grade else []
        dynamic_rubric = compute_dynamic_rubric(chat_id, grade, feedbacks)
        
        # Build hints array
        chat_messages = messages_by_chat.get(chat_id, [])
        hints_array = []
        for msg in chat_messages:
            if msg["type"] == "response" and msg["id"] in hints_by_message:
                hints_array.append({
                    "messageId": msg["id"],
                    "hints": hints_by_message[msg["id"]],
                })
        
        chats.append({
            "chat": {
                "id": chat_id,
                "createdAt": chat_row.created_at.isoformat(),
                "updatedAt": chat_row.updated_at.isoformat(),
                "title": chat_row.title,
                "scenarioId": scenario_id,
                "attemptId": str(chat_row.attempt_id),
                "completed": chat_row.completed,
                "completedAt": chat_row.completed_at.isoformat() if chat_row.completed_at else None,
                "traceId": str(chat_row.trace_id) if chat_row.trace_id else None,
            },
            "scenario": scenarios.get(scenario_id),
            "messages": chat_messages,
            "hints": hints_array,
            "grade": grade,
            "feedbacks": feedbacks,
            "dynamicRubric": dynamic_rubric,
        })
    
    # 12. Compute aggregated results
    completed_rubrics = [c["dynamicRubric"] for c in chats if c["chat"]["completed"] and c["dynamicRubric"]]
    aggregated_results = None
    if completed_rubrics:
        total_score = sum(r["score"] for r in completed_rubrics)
        average_score = total_score / len(completed_rubrics)
        passed_chats = sum(1 for r in completed_rubrics if r["passed"])
        total_time = sum(r["timeTaken"] for r in completed_rubrics)
        
        aggregated_results = {
            "totalChats": len(completed_rubrics),
            "passedChats": passed_chats,
            "averageScore": round(average_score * 10) / 10,
            "totalTime": total_time,
            "overallPassed": passed_chats == len(completed_rubrics),
        }
    
    # 13. Compute timer state
    current_time = datetime.now(timezone.utc)
    attempt_start_time = attempt_result.created_at
    
    # Calculate total elapsed time
    total_elapsed_seconds = 0
    for chat in chats:
        chat_start = datetime.fromisoformat(chat["chat"]["createdAt"].replace('Z', '+00:00'))
        if chat["chat"]["completed"] and chat["chat"]["completedAt"]:
            chat_end = datetime.fromisoformat(chat["chat"]["completedAt"].replace('Z', '+00:00'))
            chat_duration = int((chat_end - chat_start).total_seconds())
            total_elapsed_seconds += chat_duration
        else:
            # Current active chat
            chat_duration = int((current_time - chat_start).total_seconds())
            total_elapsed_seconds += chat_duration
    
    # Calculate remaining time
    time_remaining = None
    expired = False
    if attempt["infiniteMode"]:
        if attempt["infiniteModeTimeLimit"]:
            total_time_seconds = attempt["infiniteModeTimeLimit"] * 60
            time_remaining = max(total_time_seconds - total_elapsed_seconds, 0)
            expired = time_remaining <= 0
        # else: no limit, count up only
    else:
        if simulation["timeLimit"]:
            total_time_seconds = simulation["timeLimit"] * 60
            time_remaining = total_time_seconds - total_elapsed_seconds
            # Don't set expired for normal mode (allow negative display)
    
    timer = {
        "elapsed": total_elapsed_seconds,
        "remaining": time_remaining,
        "expired": expired,
    }
    
    # 14. Compute metadata
    current_chat_index = 0
    for i, chat in enumerate(chats):
        if not chat["chat"]["completed"]:
            current_chat_index = i
            break
    
    expected_chat_count = len(chats)
    is_single_chat_attempt = expected_chat_count == 1
    is_last_attempt = current_chat_index == expected_chat_count - 1
    show_results = all(c["chat"]["completed"] for c in chats) if chats else False
    is_active = not (expired or show_results)
    
    return {
        "attempt": attempt,
        "simulation": simulation,
        "attemptProfiles": attempt_profiles,
        "chats": chats,
        "scenarioDocuments": scenario_documents,
        "departmentDocuments": department_documents,
        "aggregatedResults": aggregated_results,
        "timer": timer,
        "currentChatIndex": current_chat_index,
        "expectedChatCount": expected_chat_count,
        "isSingleChatAttempt": is_single_chat_attempt,
        "isLastAttempt": is_last_attempt,
        "showResults": show_results,
        "isActive": is_active,
    }

