"""Simulation queries - SQL query builders."""

from datetime import UTC
from typing import Any


class SimulationQueries:
    """Query builders for simulation operations."""

    def list_simulations(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for simulations list with permissions and embedded mappings."""
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
        simulation_active_cohort_links AS (
            SELECT 
                cs.simulation_id,
                COUNT(*) as active_cohort_count
            FROM cohort_simulations cs
            WHERE cs.active = true
            GROUP BY cs.simulation_id
        ),
        simulation_all_cohort_links AS (
            SELECT 
                cs.simulation_id,
                COUNT(*) as total_cohort_links,
                COUNT(DISTINCT cs.cohort_id) as num_cohorts
            FROM cohort_simulations cs
            GROUP BY cs.simulation_id
        ),
        simulation_departments_data AS (
            SELECT 
                sd.simulation_id,
                ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
            FROM simulation_departments sd
            WHERE sd.active = true
            GROUP BY sd.simulation_id
        ),
        simulation_data AS (
            SELECT 
                s.id as simulation_id,
                s.title as name,
                s.description,
                stl.time_limit_seconds as time_limit,
                s.active,
                s.practice_simulation,
                s.rubric_id,
                s.updated_at,
                COALESCE(sdd.department_ids, NULL) as department_ids,
                COALESCE(ss.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(ss.num_scenarios, 0) as num_scenarios,
                COALESCE(sa.attempt_count, 0) as attempt_count,
                COALESCE(sacl.active_cohort_count, 0) as active_cohort_count,
                COALESCE(salcl.total_cohort_links, 0) as total_cohort_links,
                COALESCE(salcl.num_cohorts, 0) as num_cohorts
            FROM simulations s
            LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
            LEFT JOIN simulation_departments_data sdd ON sdd.simulation_id = s.id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
            LEFT JOIN simulation_attempts sa ON sa.simulation_id = s.id
            LEFT JOIN simulation_active_cohort_links sacl ON sacl.simulation_id = s.id
            LEFT JOIN simulation_all_cohort_links salcl ON salcl.simulation_id = s.id
            GROUP BY s.id, s.title, s.description, stl.time_limit_seconds, s.active, s.practice_simulation, 
                     s.rubric_id, s.updated_at, ss.scenario_ids, ss.num_scenarios, sa.attempt_count, 
                     sacl.active_cohort_count, salcl.total_cohort_links, salcl.num_cohorts
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY($1)) > 0
                OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        all_scenario_ids AS (
            SELECT DISTINCT unnest(scenario_ids) as scenario_id
            FROM simulation_data
        ),
        scenario_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.name,
                        'description', COALESCE(sps.problem_statement, ''),
                        'active', s.active,
                        'persona_id', (
                            SELECT persona_id 
                            FROM scenario_personas sp 
                            WHERE sp.scenario_id = s.id AND sp.active = true 
                            LIMIT 1
                        ),
                        'persona_mapping', '{}'::jsonb,
                        'document_mapping', '{}'::jsonb,
                        'parameter_item_mapping', '{}'::jsonb,
                        'parameter_item_ids', ARRAY[]::text[],
                        'document_ids', ARRAY[]::text[]
                    )
                ) FILTER (WHERE s.id IS NOT NULL AND st.parent_id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_scenario_ids asi
            LEFT JOIN scenarios s ON s.id = asi.scenario_id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            -- Only include root scenarios (parent_id = child_id in scenario_tree)
            LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
        ),
        all_rubric_ids AS (
            SELECT DISTINCT rubric_id
            FROM simulation_data
            WHERE rubric_id IS NOT NULL
        ),
        rubric_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    r.id::text,
                    jsonb_build_object(
                        'name', r.name,
                        'description', COALESCE(r.description, '')
                    )
                ) FILTER (WHERE r.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_rubric_ids ari
            LEFT JOIN rubrics r ON r.id = ari.rubric_id
        )
        SELECT 
            sd.*,
            CASE 
                WHEN sd.active_cohort_count > 0 THEN false
                WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN sd.practice_simulation = true THEN false
                WHEN sd.total_cohort_links > 0 THEN false
                WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate,
            sm.mapping as scenario_mapping,
            rm.mapping as rubric_mapping
        FROM simulation_data sd
        CROSS JOIN user_profile up
        CROSS JOIN scenario_mapping_data sm
        CROSS JOIN rubric_mapping_data rm
        ORDER BY sd.updated_at DESC NULLS LAST
        """

        return (query, [department_ids, profile_id])

    def get_simulation_by_id(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to get simulation by ID."""
        query = """
        SELECT 
            id,
            title,
            description,
            active,
            practice_simulation,
            hints_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            rubric_id
        FROM simulations
        WHERE id = $1
        """
        return (query, [simulation_id])

    def get_simulation_scenarios(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to get simulation's scenarios."""
        query = """
        SELECT scenario_id FROM simulation_scenarios 
        WHERE simulation_id = $1 AND active = true
        """
        return (query, [simulation_id])

    def get_valid_scenarios(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid scenarios - only returns root/parent scenarios."""
        query = """
        SELECT DISTINCT s.id 
        FROM scenarios s
        LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
        WHERE s.active = true
          AND (
            -- Either not in tree at all (standalone)
            NOT EXISTS (
              SELECT 1 FROM scenario_tree st 
              WHERE st.child_id = s.id AND st.parent_id != st.child_id
            )
            -- Or is a root (self-edge)
            OR EXISTS (
              SELECT 1 FROM scenario_tree st 
              WHERE st.child_id = s.id AND st.parent_id = st.child_id
            )
          )
        GROUP BY s.id, s.name
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(sd.scenario_id) FILTER (WHERE sd.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
        ORDER BY s.name
        """
        return (query, [dept_ids])

    def get_valid_rubrics(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid rubrics."""
        query = """
        SELECT DISTINCT r.id, r.name, COALESCE(r.description, '') as description 
        FROM rubrics r
        LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
        WHERE r.active = true
        GROUP BY r.id, r.name, r.description
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(rd.rubric_id) FILTER (WHERE rd.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
        ORDER BY r.name
        """
        return (query, [dept_ids])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1 AND d.active = true
        ORDER BY d.title
        """
        return (query, [profile_id])

    def get_default_simulation(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query for default simulation."""
        query = """
        WITH user_departments AS (
            SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        )
        SELECT s.id
        FROM simulations s
        LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
        WHERE s.active = true
        GROUP BY s.id
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY((SELECT dept_ids FROM user_departments))) > 0
            OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ORDER BY s.created_at DESC
        LIMIT 1
        """
        return (query, [profile_id])

    def create_simulation(self) -> str:
        """Build query to create simulation.

        Params order: title, description, active, practice_simulation, hints_enabled, 
        objectives_enabled, input_guardrail_active, output_guardrail_active, image_input_active, rubric_id
        """
        return """
        INSERT INTO simulations (
            title,
            description,
            active,
            practice_simulation,
            hints_enabled,
            objectives_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            rubric_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        """

    def insert_simulation_scenario(self) -> str:
        """Build query to insert simulation scenario.

        Params order: simulation_id, scenario_id, active, position
        """
        return """
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position)
        VALUES ($1, $2, $3, $4)
        """

    def get_simulation_name(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to get simulation name."""
        query = "SELECT title FROM simulations WHERE id = $1"
        return (query, [simulation_id])

    def update_simulation(self) -> str:
        """Build query to update simulation.

        Params order: title, description, active, practice_simulation, hints_enabled, 
        objectives_enabled, input_guardrail_active, output_guardrail_active, image_input_active, rubric_id, simulation_id
        """
        return """
        UPDATE simulations SET
            title = $1,
            description = $2,
            active = $3,
            practice_simulation = $4,
            hints_enabled = $5,
            objectives_enabled = $6,
            input_guardrail_active = $7,
            output_guardrail_active = $8,
            image_input_active = $9,
            rubric_id = $10,
            updated_at = NOW()
        WHERE id = $11
        """

    def delete_simulation_scenarios(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to delete simulation scenarios."""
        query = """
        DELETE FROM simulation_scenarios WHERE simulation_id = $1
        """
        return (query, [simulation_id])

    def get_simulation_for_duplicate(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to get simulation data for duplication."""
        query = """
        SELECT 
            title,
            description,
            department_id,
            hints_enabled,
            objectives_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            rubric_id
        FROM simulations
        WHERE id = $1
        """
        return (query, [simulation_id])

    def insert_duplicate_simulation(self) -> str:
        """Build query to insert duplicate simulation.

        Params order: title, description, department_id, hints_enabled, objectives_enabled,
        input_guardrail_active, output_guardrail_active, image_input_active, rubric_id
        """
        return """
        INSERT INTO simulations (
            title,
            description,
            department_id,
            active,
            default_simulation,
            practice_simulation,
            hints_enabled,
            objectives_enabled,
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            rubric_id
        )
        VALUES (
            $1 || ' Copy',
            $2,
            $3,
            false,
            false,
            false,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
        )
        RETURNING id
        """

    def copy_simulation_scenarios(self) -> str:
        """Build query to copy simulation scenarios.

        Params order: new_simulation_id, original_simulation_id
        """
        return """
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position)
        SELECT $1, scenario_id, active, position
        FROM simulation_scenarios
        WHERE simulation_id = $2
        """

    def check_simulation_usage(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to check simulation usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulation_attempts
        WHERE simulation_id = $1
        """
        return (query, [simulation_id])

    def delete_simulation(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to delete simulation."""
        query = "DELETE FROM simulations WHERE id = $1"
        return (query, [simulation_id])

    # ===== Simulation Time Limits Junction Table Queries =====

    def insert_simulation_time_limit(self) -> str:
        """Build query to insert simulation time limit.

        Params order: simulation_id, time_limit_seconds
        """
        return """
        INSERT INTO simulation_time_limits (simulation_id, time_limit_seconds)
        VALUES ($1, $2)
        """

    def delete_simulation_time_limit(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to delete simulation time limit."""
        query = "DELETE FROM simulation_time_limits WHERE simulation_id = $1"
        return (query, [simulation_id])

    def get_simulation_time_limit(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to get simulation time limit."""
        query = """
        SELECT time_limit_seconds 
        FROM simulation_time_limits 
        WHERE simulation_id = $1 AND active = true
        """
        return (query, [simulation_id])

    # ===== WebSocket Simulation Attempt Queries =====

    def create_attempt(self) -> str:
        """Build query to create simulation attempt.

        Params order: simulation_id, infinite_mode
        """
        return """
        INSERT INTO simulation_attempts (simulation_id, infinite_mode)
        VALUES ($1, $2)
        RETURNING *
        """

    def create_attempt_profile(self) -> str:
        """Build query to create attempt_profiles junction record.

        Params order: attempt_id, profile_id, active
        """
        return """
        INSERT INTO attempt_profiles (attempt_id, profile_id, active)
        VALUES ($1, $2, $3)
        """

    def get_scenario_by_id(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario by ID."""
        query = "SELECT * FROM scenarios WHERE id = $1"
        return (query, [scenario_id])

    def get_all_scenarios_minimal(self) -> tuple[str, list[Any]]:
        """Build query to get all scenario IDs (for random selection)."""
        query = "SELECT id FROM scenarios"
        return (query, [])

    def get_scenario_full_metadata(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build optimized query to get scenario with all related data in single query.

        Returns scenario data plus:
        - document_ids: array of document IDs
        - parameter_item_ids: array of parameter item IDs
        - persona_id: active persona ID (or null)

        This prevents N+1 queries by using LEFT JOINs and ARRAY_AGG.
        """
        query = """
        SELECT 
            s.id,
            s.name,
            sps.problem_statement,
            s.active,
            s.default_scenario,
            s.generated,
            s.department_id,
            s.created_at,
            s.updated_at,
            s.use_documents,
            COALESCE(ARRAY_AGG(DISTINCT sd.document_id) FILTER (WHERE sd.document_id IS NOT NULL), ARRAY[]::uuid[]) as document_ids,
            COALESCE(ARRAY_AGG(DISTINCT spi.parameter_item_id) FILTER (WHERE spi.parameter_item_id IS NOT NULL), ARRAY[]::uuid[]) as parameter_item_ids,
            (SELECT persona_id FROM scenario_personas WHERE scenario_id = s.id AND active = true LIMIT 1) as persona_id
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
        LEFT JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
        WHERE s.id = $1
        GROUP BY s.id, s.name, sps.problem_statement, s.active, s.default_scenario, 
                 s.generated, s.department_id, s.created_at, s.updated_at, s.use_documents
        """
        return (query, [scenario_id])

    def get_simulation_scenarios_ordered(
        self, simulation_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to get simulation's scenarios with position ordering."""
        query = """
        SELECT scenario_id, position 
        FROM simulation_scenarios 
        WHERE simulation_id = $1
        ORDER BY position
        """
        return (query, [simulation_id])

    def get_attempt_by_id(self, attempt_id: str) -> tuple[str, list[Any]]:
        """Build query to get attempt by ID."""
        query = "SELECT * FROM simulation_attempts WHERE id = $1"
        return (query, [attempt_id])

    def get_attempt_with_profile(self, attempt_id: str) -> tuple[str, list[Any]]:
        """Build optimized query to get attempt with active profile in single query."""
        query = """
        SELECT 
            sa.*,
            (SELECT profile_id FROM attempt_profiles WHERE attempt_id = sa.id AND active = true LIMIT 1) as profile_id
        FROM simulation_attempts sa
        WHERE sa.id = $1
        """
        return (query, [attempt_id])

    def create_simulation_chat(self) -> str:
        """Build query to create simulation chat.

        Params order: created_at, title, scenario_id, attempt_id, completed, trace_id
        """
        return """
        INSERT INTO simulation_chats (created_at, title, scenario_id, attempt_id, completed, trace_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """

    def get_chat_by_id(self, chat_id: str) -> tuple[str, list[Any]]:
        """Build query to get chat by ID."""
        query = "SELECT * FROM simulation_chats WHERE id = $1"
        return (query, [chat_id])

    def get_chat_basic(self, chat_id: str) -> tuple[str, list[Any]]:
        """Build query to get basic chat info."""
        query = "SELECT id, completed FROM simulation_chats WHERE id = $1"
        return (query, [chat_id])

    def update_chat_completed(self, chat_id: str) -> tuple[str, list[Any]]:
        """Build query to mark chat as completed."""
        query = "UPDATE simulation_chats SET completed = true WHERE id = $1"
        return (query, [chat_id])

    def get_existing_chats_for_attempt(self, attempt_id: str) -> tuple[str, list[Any]]:
        """Build query to get all chats for an attempt."""
        query = """
        SELECT id, completed, scenario_id
        FROM simulation_chats 
        WHERE attempt_id = $1
        ORDER BY created_at
        """
        return (query, [attempt_id])

    def get_simulation_metadata_for_chat(self, chat_id: str) -> tuple[str, list[Any]]:
        """Build optimized query to get simulation metadata from chat in single JOIN.

        Returns simulation_id, attempt_id, practice_simulation via 3-table JOIN.
        """
        query = """
        SELECT 
            s.id as simulation_id,
            s.practice_simulation,
            sa.id as attempt_id
        FROM simulation_chats sc
        JOIN simulation_attempts sa ON sa.id = sc.attempt_id
        JOIN simulations s ON s.id = sa.simulation_id
        WHERE sc.id = $1
        """
        return (query, [chat_id])

    # ===== Message Queries =====

    def create_message(self) -> str:
        """Build query to create simulation message.

        Params order: chat_id, type, content, completed
        """
        return """
        INSERT INTO simulation_messages (chat_id, type, content, completed, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, created_at
        """

    def update_message_content(self) -> str:
        """Build query to update message content.

        Params order: content, message_id
        """
        return """
        UPDATE simulation_messages 
        SET content = $1 
        WHERE id = $2
        """

    def update_message_completed(self) -> str:
        """Build query to mark message as completed.

        Params order: message_id
        """
        return """
        UPDATE simulation_messages 
        SET completed = true 
        WHERE id = $1
        """

    def update_message_content_and_completed(self) -> str:
        """Build query to update message content and mark completed.

        Params order: content, message_id
        """
        return """
        UPDATE simulation_messages 
        SET content = $1, completed = true 
        WHERE id = $2
        """

    def get_incomplete_messages_for_chat(self, chat_id: str) -> tuple[str, list[Any]]:
        """Build query to get incomplete response messages for a chat."""
        query = """
        SELECT id, content, completed, created_at
        FROM simulation_messages
        WHERE chat_id = $1 AND type = 'response' AND completed = false
        ORDER BY created_at DESC
        """
        return (query, [chat_id])

    def get_messages_count_by_chat_ids(
        self, chat_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build optimized batch query to get message counts for multiple chats.

        This prevents N+1 queries when checking message counts for multiple chats.
        Returns: chat_id, message_count
        """
        query = """
        SELECT chat_id, COUNT(*) as message_count
        FROM simulation_messages
        WHERE chat_id = ANY($1::uuid[])
        GROUP BY chat_id
        """
        return (query, [chat_ids])

    # ===== Analytics Queries for MCP Tools =====

    def get_simulation_attempts_list(
        self, simulation_id: str, limit: int
    ) -> tuple[str, list[Any]]:
        """Build query to list all attempts for a simulation with grades."""
        query = """
        WITH attempt_data AS (
            SELECT 
                sa.id,
                sa.created_at,
                ap.profile_id,
                p.first_name,
                p.last_name,
                p.alias
            FROM simulation_attempts sa
            LEFT JOIN attempt_profiles ap ON sa.id = ap.attempt_id AND ap.active = true
            LEFT JOIN profiles p ON p.id = ap.profile_id
            WHERE sa.simulation_id = $1
            ORDER BY sa.created_at DESC
            LIMIT $2
        ),
        latest_grades AS (
            SELECT DISTINCT ON (sc.attempt_id)
                sc.attempt_id,
                scg.score,
                scg.passed,
                scg.time_taken
            FROM simulation_chats sc
            JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            WHERE sc.attempt_id IN (SELECT id FROM attempt_data)
            ORDER BY sc.attempt_id, sc.created_at DESC
        )
        SELECT 
            ad.id,
            ad.created_at,
            ad.profile_id,
            ad.first_name,
            ad.last_name,
            ad.alias,
            lg.score,
            lg.passed,
            lg.time_taken
        FROM attempt_data ad
        LEFT JOIN latest_grades lg ON lg.attempt_id = ad.id
        ORDER BY ad.created_at DESC
        """
        return (query, [simulation_id, limit])

    def search_simulations_fuzzy(
        self, where_clause: str, limit: int
    ) -> tuple[str, list[Any]]:
        """
        Build fuzzy search query for simulations by title.
        Uses dynamic WHERE clause built by search utilities.

        Params: Built dynamically by search utilities, plus limit at end
        """
        query = f"""
            SELECT 
                s.id,
                s.title,
                s.active,
                stl.time_limit_seconds as time_limit,
                s.created_at
            FROM simulations s
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            WHERE {where_clause}
            LIMIT ${{param_count}}
        """
        return (query, [limit])

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile role."""
        query = "SELECT role FROM profiles WHERE id = $1"
        return (query, [profile_id])

    def update_chat_created_at(self) -> str:
        """Build query to update chat created_at timestamp.

        Params order: created_at, chat_id
        """
        return "UPDATE simulation_chats SET created_at = $1 WHERE id = $2"

    # update_chat_completed_at removed - completed_at column dropped
    # Use completed boolean + updated_at instead

    def insert_error_message(self) -> str:
        """Build query to insert an error message in simulation chat.

        Params order: chat_id, type, content, completed
        """
        return """
        INSERT INTO simulation_messages 
        (chat_id, type, content, completed, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
        """

    # ===== Additional queries for simulation detail building =====

    def get_cohort_usage_for_simulation(
        self, simulation_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to check cohort usage for a simulation."""
        query = """
        SELECT COUNT(*) as cohort_count
        FROM cohort_simulations
        WHERE simulation_id = $1
        """
        return (query, [simulation_id])

    def get_scenarios_with_positions(
        self, simulation_id: str, scenario_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get scenarios with their positions in simulation."""
        query = """
        SELECT 
            s.id,
            s.name,
            sps.problem_statement,
            s.active,
            s.default_scenario,
            ss.position
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        JOIN simulation_scenarios ss ON ss.scenario_id = s.id
        WHERE ss.simulation_id = $1 AND s.id = ANY($2::uuid[])
        ORDER BY ss.position
        """
        return (query, [simulation_id, scenario_ids])

    def get_scenario_parameter_items(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get parameter item IDs for a scenario."""
        query = """
        SELECT parameter_item_id
        FROM scenario_parameter_items
        WHERE scenario_id = $1
        """
        return (query, [scenario_id])

    def get_parameters_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameters for departments."""
        query = """
        SELECT id, name, COALESCE(description, '') as description
        FROM parameters
        WHERE department_id = ANY($1::uuid[])
        ORDER BY name
        """
        return (query, [department_ids])

    def get_parameter_items_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items with parameter info for departments."""
        query = """
        SELECT pi.id, pi.parameter_id, pi.name, COALESCE(pi.description, '') as description
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE p.department_id = ANY($1::uuid[])
        ORDER BY p.name, pi.name
        """
        return (query, [department_ids])

    def get_simulation_overview_complete(self, sim_id: Any) -> tuple[str, list[Any]]:
        """Build optimized query to get simulation overview with all related data in ONE query.

        Fetches simulation + rubric + cohorts + scenarios + pass stats using LEFT JOINs
        and JSON aggregation to avoid N+1 queries.

        Args:
            sim_id: UUID of the simulation

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH stats AS (
            SELECT 
                COUNT(DISTINCT sa.id) as total_attempts,
                COUNT(DISTINCT scg.id) as total_graded,
                SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END) as total_passed
            FROM simulation_attempts sa
            LEFT JOIN simulation_chats sc ON sc.attempt_id = sa.id
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            WHERE sa.simulation_id = $1
        )
        SELECT 
            s.id, s.title, s.active, stl.time_limit_seconds as time_limit, s.created_at,
            -- Rubric data (LEFT JOIN, single row)
            jsonb_build_object(
                'id', r.id, 
                'name', r.name, 
                'description', r.description,
                'points', r.points,
                'pass_points', r.pass_points
            ) as rubric,
            -- Cohorts array (json_agg with filtering)
            COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object(
                    'id', c.id,
                    'title', c.title,
                    'active', c.active
                )) FILTER (WHERE c.id IS NOT NULL),
                '[]'::jsonb
            ) as cohorts,
            -- Scenarios array (json_agg with ordering)
            COALESCE(
                jsonb_agg(jsonb_build_object(
                    'id', sc.id,
                    'name', sc.name,
                    'problem_statement', sps.problem_statement,
                    'position', ss.position
                ) ORDER BY ss.position) FILTER (WHERE sc.id IS NOT NULL),
                '[]'::jsonb
            ) as scenarios,
            -- Stats from CTE
            st.total_attempts, st.total_graded, st.total_passed
        FROM simulations s
        LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        LEFT JOIN rubrics r ON r.id = s.rubric_id
        LEFT JOIN cohort_simulations cs ON cs.simulation_id = s.id AND cs.active = true
        LEFT JOIN cohorts c ON c.id = cs.cohort_id
        LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
        LEFT JOIN scenarios sc ON sc.id = ss.scenario_id
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = sc.id AND sps.active = true
        CROSS JOIN stats st
        WHERE s.id = $1
        GROUP BY s.id, s.title, s.active, stl.time_limit_seconds, s.created_at, r.id, r.name, 
                 r.description, r.points, r.pass_points, st.total_attempts, 
                 st.total_graded, st.total_passed
        """
        return (query, [sim_id])

    def get_simulation_detail_complete(
        self, simulation_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get all simulation detail data in ONE query.

        Consolidates ~16 queries into 1 using CTEs and JSONB aggregations.
        Returns all data needed for SimulationDetailResponse.
        """
        query = """
        WITH         simulation_base AS (
            SELECT 
                s.id,
                s.title,
                s.description,
                s.department_id,
                s.active,
                s.default_simulation,
                s.practice_simulation,
                s.hints_enabled,
                s.objectives_enabled,
                s.input_guardrail_active,
                s.output_guardrail_active,
                s.image_input_active,
                s.rubric_id,
                stl.time_limit_seconds as time_limit
            FROM simulations s
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            WHERE s.id = $1
        ),
        user_context AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        cohort_usage AS (
            SELECT COUNT(*) as cohort_count
            FROM cohort_simulations
            WHERE simulation_id = $1
        ),
        user_departments AS (
            SELECT DISTINCT d.id, d.title as name, d.description
            FROM departments d
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        user_department_ids AS (
            SELECT ARRAY_AGG(id) as ids
            FROM user_departments
        ),
        simulation_scenarios_base AS (
            SELECT 
                s.id as scenario_id,
                s.name,
                sps.problem_statement,
                ss.active,
                s.default_scenario,
                ss.position,
                COALESCE(
                    (SELECT ARRAY_AGG(DISTINCT spi.parameter_item_id)
                     FROM scenario_parameter_items spi
                     WHERE spi.scenario_id = s.id AND spi.active = true),
                    ARRAY[]::uuid[]
                ) as parameter_item_ids
            FROM scenarios s
            JOIN simulation_scenarios ss ON ss.scenario_id = s.id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            WHERE ss.simulation_id = $1
            ORDER BY ss.position
        ),
        scenario_statistics AS (
            SELECT 
                ss.scenario_id,
                -- Find root scenario: if parent_id = child_id exists, that's the root, otherwise use scenario itself
                COALESCE(
                    (SELECT st.parent_id 
                     FROM scenario_tree st 
                     WHERE st.child_id = ss.scenario_id 
                       AND st.parent_id = st.child_id 
                     LIMIT 1),
                    ss.scenario_id
                ) as root_scenario_id,
                -- Usage: count of ALL chats with this root scenario (regardless of completion)
                COUNT(DISTINCT sc.id) as usage_count,
                -- Success rate: percentage of completed chats that passed
                CASE 
                    WHEN COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END) > 0 
                    THEN ROUND(
                        (COUNT(DISTINCT CASE WHEN sc.completed = true AND scg.passed = true THEN sc.id END)::numeric / 
                         COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END)::numeric) * 100
                    )
                    ELSE 0 
                END as success_rate,
                -- Last used: most recent chat created_at
                MAX(sc.created_at) as last_used_date
            FROM simulation_scenarios ss
            LEFT JOIN simulation_chats sc ON (
                -- Match chats where scenario_id is in the tree with ss.scenario_id as root
                sc.scenario_id IN (
                    SELECT st2.child_id 
                    FROM scenario_tree st2 
                    WHERE st2.parent_id = COALESCE(
                        (SELECT st3.parent_id 
                         FROM scenario_tree st3 
                         WHERE st3.child_id = ss.scenario_id 
                           AND st3.parent_id = st3.child_id),
                        ss.scenario_id
                    )
                )
                OR sc.scenario_id = ss.scenario_id
            )
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            WHERE ss.simulation_id = $1
            GROUP BY ss.scenario_id
        ),
        scenarios_list_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'scenario_id', sb.scenario_id::text,
                        'title', sb.name,
                        'description', COALESCE(sb.problem_statement, ''),
                        'active', sb.active,
                        'default_scenario', COALESCE(sb.default_scenario, false),
                        'position', sb.position,
                        'parameter_item_ids', (
                            SELECT COALESCE(jsonb_agg(pid::text), '[]'::jsonb)
                            FROM unnest(sb.parameter_item_ids) as pid
                        ),
                        'usage_count', COALESCE(stats.usage_count, 0),
                        'success_rate', COALESCE(stats.success_rate, 0),
                        'last_used', stats.last_used_date,
                        'can_remove', COALESCE(stats.usage_count, 0) = 0
                    ) ORDER BY sb.position
                ),
                '[]'::jsonb
            ) as scenarios_list,
            COALESCE(ARRAY_AGG(sb.scenario_id::text), ARRAY[]::text[]) as scenario_ids
            FROM simulation_scenarios_base sb
            LEFT JOIN scenario_statistics stats ON stats.scenario_id = sb.scenario_id
        ),
        valid_scenarios_list AS (
            -- Get scenarios that are marked as roots in scenario_tree (parent_id = child_id)
            -- and are active and in user's departments
            SELECT DISTINCT
                s.id,
                s.name,
                sps.problem_statement
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            CROSS JOIN user_department_ids udi
            JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            WHERE s.department_id = ANY(udi.ids) 
              AND s.active = true
        ),
        valid_scenarios AS (
            SELECT ARRAY_AGG(id::text) as ids
            FROM valid_scenarios_list
        ),
        valid_rubrics_data AS (
            SELECT 
                r.id,
                r.name,
                COALESCE(r.description, '') as description
            FROM rubrics r, user_department_ids udi
            WHERE r.department_id = ANY(udi.ids) AND r.active = true
        ),
        rubric_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vr.id::text,
                    jsonb_build_object(
                        'name', vr.name,
                        'description', vr.description
                    )
                ),
                '{}'::jsonb
            ) as rubric_mapping,
            COALESCE(ARRAY_AGG(vr.id::text), ARRAY[]::text[]) as rubric_ids
            FROM valid_rubrics_data vr
        ),
        parameters_data AS (
            SELECT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.numerical
            FROM parameters p, user_department_ids udi
            WHERE p.department_id = ANY(udi.ids)
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pd.id::text,
                    jsonb_build_object(
                        'name', pd.name,
                        'description', pd.description,
                        'numerical', pd.numerical
                    )
                ),
                '{}'::jsonb
            ) as parameter_mapping
            FROM parameters_data pd
        ),
        parameter_items_data AS (
            SELECT 
                pi.id,
                pi.parameter_id,
                pi.name,
                COALESCE(pi.description, '') as description,
                p.name as parameter_name,
                pi.value
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.id IN (SELECT id FROM parameters_data)
        ),
        parameter_items_list_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', pid.id::text,
                        'parameter_id', pid.parameter_id::text,
                        'name', pid.name,
                        'description', pid.description
                    )
                ),
                '[]'::jsonb
            ) as parameter_items_list
            FROM parameter_items_data pid
        ),
        parameter_item_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pid.id::text,
                    jsonb_build_object(
                        'name', pid.name,
                        'description', pid.description,
                        'parameter_id', pid.parameter_id::text,
                        'parameter_name', pid.parameter_name,
                        'value', pid.value
                    )
                ),
                '{}'::jsonb
            ) as parameter_item_mapping
            FROM parameter_items_data pid
        ),
        scenario_persona_data AS (
            SELECT 
                sp.scenario_id,
                sp.persona_id,
                p.name as persona_name,
                COALESCE(p.description, '') as persona_description,
                p.color as persona_color,
                p.icon as persona_icon
            FROM scenario_personas sp
            JOIN personas p ON p.id = sp.persona_id
            WHERE sp.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sp.active = true
        ),
        scenario_documents_data AS (
            SELECT 
                sd.scenario_id,
                ARRAY_AGG(sd.document_id) as document_ids
            FROM scenario_documents sd
            WHERE sd.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sd.active = true
            GROUP BY sd.scenario_id
        ),
        scenario_parameter_items_data AS (
            SELECT 
                spi.scenario_id,
                ARRAY_AGG(DISTINCT spi.parameter_item_id) as parameter_item_ids
            FROM scenario_parameter_items spi
            WHERE spi.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND spi.active = true
            GROUP BY spi.scenario_id
        ),
        all_document_ids AS (
            SELECT DISTINCT unnest(document_ids) as document_id
            FROM scenario_documents_data
        ),
        document_mapping_base AS (
            SELECT 
                d.id,
                d.name,
                d.type::text as description
            FROM documents d
            WHERE d.id IN (SELECT document_id FROM all_document_ids)
        ),
        scenario_mapping_complete AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vsl.id::text,
                    jsonb_build_object(
                        'name', vsl.name,
                        'description', COALESCE(vsl.problem_statement, ''),
                        'persona_id', spd.persona_id::text,
                        'persona_mapping', CASE 
                            WHEN spd.persona_id IS NOT NULL THEN
                                jsonb_build_object(
                                    spd.persona_id::text,
                                    jsonb_build_object(
                                        'name', spd.persona_name,
                                        'description', spd.persona_description,
                                        'color', spd.persona_color,
                                        'icon', spd.persona_icon
                                    )
                                )
                            ELSE '{}'::jsonb
                        END,
                        'document_mapping', COALESCE(
                            (SELECT jsonb_object_agg(
                                dmb.id::text,
                                jsonb_build_object(
                                    'name', dmb.name,
                                    'description', dmb.description
                                )
                            )
                            FROM document_mapping_base dmb
                            WHERE dmb.id = ANY(sdd.document_ids)),
                            '{}'::jsonb
                        ),
                        'parameter_item_mapping', COALESCE(
                            (SELECT jsonb_object_agg(
                                pid.id::text,
                                jsonb_build_object(
                                    'name', pid.name,
                                    'description', pid.description,
                                    'parameter_id', pid.parameter_id::text,
                                    'parameter_name', pid.parameter_name
                                )
                            )
                            FROM parameter_items_data pid
                            WHERE pid.id = ANY(spid.parameter_item_ids)),
                            '{}'::jsonb
                        ),
                        'parameter_item_ids', COALESCE(
                            (SELECT jsonb_agg(pid::text)
                             FROM unnest(spid.parameter_item_ids) as pid),
                            '[]'::jsonb
                        ),
                        'document_ids', COALESCE(
                            (SELECT jsonb_agg(did::text)
                             FROM unnest(sdd.document_ids) as did),
                            '[]'::jsonb
                        )
                    )
                ),
                '{}'::jsonb
            ) as scenario_mapping
            FROM valid_scenarios_list vsl
            LEFT JOIN scenario_persona_data spd ON spd.scenario_id = vsl.id
            LEFT JOIN scenario_documents_data sdd ON sdd.scenario_id = vsl.id
            LEFT JOIN scenario_parameter_items_data spid ON spid.scenario_id = vsl.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    ud.id::text,
                    jsonb_build_object(
                        'name', ud.name,
                        'description', COALESCE(ud.description, '')
                    )
                ),
                '{}'::jsonb
            ) as department_mapping,
            COALESCE(ARRAY_AGG(ud.id::text), ARRAY[]::text[]) as department_ids
            FROM user_departments ud
        )
        SELECT 
            -- Basic simulation fields
            sb.title,
            sb.description,
            sb.department_id::text,
            sb.time_limit,
            sb.rubric_id::text,
            sb.active,
            sb.default_simulation,
            sb.practice_simulation,
            sb.hints_enabled,
            sb.objectives_enabled,
            sb.input_guardrail_active,
            sb.output_guardrail_active,
            sb.image_input_active,
            -- User context
            uc.role as user_role,
            COALESCE(cu.cohort_count, 0) as cohort_count,
            -- Scenarios
            sld.scenarios_list,
            sld.scenario_ids,
            -- Valid IDs
            COALESCE(vs.ids, ARRAY[]::text[]) as valid_scenario_ids,
            COALESCE(rmd.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
            dmd.department_ids as valid_department_ids,
            -- Mappings
            smc.scenario_mapping,
            rmd.rubric_mapping,
            dmd.department_mapping,
            pmd.parameter_mapping,
            pimd.parameter_item_mapping,
            -- Parameter items list
            pild.parameter_items_list
        FROM simulation_base sb
        CROSS JOIN user_context uc
        LEFT JOIN cohort_usage cu ON true
        LEFT JOIN scenarios_list_data sld ON true
        LEFT JOIN valid_scenarios vs ON true
        LEFT JOIN rubric_mapping_data rmd ON true
        LEFT JOIN parameter_mapping_data pmd ON true
        LEFT JOIN parameter_item_mapping_data pimd ON true
        LEFT JOIN parameter_items_list_data pild ON true
        LEFT JOIN scenario_mapping_complete smc ON true
        LEFT JOIN department_mapping_data dmd ON true
        """
        return (query, [simulation_id, profile_id])

    def start_simulation_attempt_complete(
        self,
        simulation_id: str,
        profile_id: str | None,
        scenario_id_override: str | None,
        infinite: bool,
        department_id: str,
    ) -> tuple[str, list[Any]]:
        """
        Single query to start simulation attempt with all related data.
        
        Consolidates 6-10 separate queries into one using CTEs and data-modifying statements.
        Handles attempt creation, scenario selection, metadata fetching, and chat creation.
        
        Args:
            simulation_id: UUID of simulation to start
            profile_id: UUID of profile (can be None for guests)
            scenario_id_override: UUID of specific scenario to use (optional)
            infinite: Whether attempt has infinite time
            department_id: UUID of department for context
            
        Returns:
            Tuple of (query, params) that returns single row with all needed data
        """
        query = """
        WITH 
        -- Create the attempt first
        new_attempt AS (
            INSERT INTO simulation_attempts (simulation_id, infinite_mode, created_at)
            VALUES ($1, $2, now())
            RETURNING id as attempt_id
        ),
        -- Create attempt_profiles junction if profile exists
        attempt_profile_link AS (
            INSERT INTO attempt_profiles (attempt_id, profile_id, active, created_at, updated_at)
            SELECT na.attempt_id, $3::uuid, true, now(), now()
            FROM new_attempt na
            WHERE $3 IS NOT NULL
            RETURNING attempt_id
        ),
        -- Get simulation data
        simulation_data AS (
            SELECT 
                s.id,
                s.title,
                s.description,
                s.department_id,
                s.active,
                s.default_simulation,
                s.practice_simulation,
                s.hints_enabled,
                s.input_guardrail_active,
                s.output_guardrail_active,
                s.image_input_active,
                s.rubric_id
            FROM simulations s
            WHERE s.id = $1
        ),
        -- Get simulation scenarios in order
        simulation_scenarios AS (
            SELECT 
                ss.scenario_id,
                ss.position
            FROM simulation_scenarios ss
            WHERE ss.simulation_id = $1 AND ss.active = true
            ORDER BY ss.position
        ),
        -- Determine chosen scenario
        chosen_scenario_id AS (
            SELECT 
                CASE 
                    WHEN COALESCE($4, '') != '' THEN $4::uuid  -- scenario_id_override
                    WHEN EXISTS(SELECT 1 FROM simulation_scenarios) THEN 
                        (SELECT scenario_id FROM simulation_scenarios 
                         ORDER BY position LIMIT 1)
                    ELSE (
                        SELECT s.id 
                        FROM scenarios s 
                        WHERE s.department_id = $5::uuid 
                        ORDER BY random() 
                        LIMIT 1
                    )
                END as scenario_id
        ),
        -- Get full scenario data with all metadata
        scenario_full_data AS (
            SELECT 
                s.id as scenario_id,
                s.name as scenario_name,
                sps.problem_statement,
                s.active,
                s.default_scenario,
                s.generated,
                s.department_id,
                -- Persona data
                p.id as persona_id,
                p.name as persona_name,
                p.system_prompt,
                p.temperature,
                p.reasoning,
                p.color as persona_color,
                p.icon as persona_icon,
                -- Model data
                m.id as model_id,
                m.name as model_name,
                m.custom_model,
                -- Provider data
                pr.id as provider_id,
                pr.name as provider_name,
                COALESCE(pe.base_url, '') as base_url,
                pr.api_key,
                -- Documents (aggregated)
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', d.id::text,
                            'name', d.name,
                            'file_path', d.file_path,
                            'mime_type', d.mime_type
                        ) ORDER BY d.id
                    ) FILTER (WHERE d.id IS NOT NULL AND sd.active = true),
                    '[]'::json
                ) as documents,
                -- Parameter items (aggregated)
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pi.id::text,
                            'name', pi.name,
                            'description', pi.description,
                            'parameter_id', pi.parameter_id::text,
                            'parameter_name', p_param.name
                        ) ORDER BY pi.id
                    ) FILTER (WHERE pi.id IS NOT NULL AND spi.active = true),
                    '[]'::json
                ) as parameter_items,
                -- Check if scenario needs generation
                CASE 
                    WHEN sps.problem_statement IS NULL OR sps.problem_statement = '' THEN true
                    ELSE false
                END as needs_generation
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            CROSS JOIN chosen_scenario_id csi
            LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
            LEFT JOIN personas p ON p.id = sp.persona_id
            LEFT JOIN models m ON m.id = p.model_id
            LEFT JOIN providers pr ON pr.id = m.provider_id
            LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
            LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
            LEFT JOIN documents d ON d.id = sd.document_id
            LEFT JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
            LEFT JOIN parameter_items pi ON pi.id = spi.parameter_item_id
            LEFT JOIN parameters p_param ON p_param.id = pi.parameter_id
            WHERE s.id = csi.scenario_id
            GROUP BY s.id, s.name, sps.problem_statement, s.active, s.default_scenario, 
                     s.generated, s.department_id, p.id, p.name, p.system_prompt, 
                     p.temperature, p.reasoning, p.color, p.icon, m.id, m.name, m.custom_model,
                     pr.id, pr.name, pr.api_key, pe.base_url
        ),
        -- Create simulation chat
        new_chat AS (
            INSERT INTO simulation_chats (
                created_at, title, scenario_id, attempt_id, completed, trace_id, updated_at
            )
            SELECT 
                now(),
                COALESCE(sfd.scenario_name, 'New Simulation'),
                sfd.scenario_id,
                na.attempt_id,
                false,
                gen_random_uuid(),
                now()
            FROM new_attempt na
            CROSS JOIN scenario_full_data sfd
            RETURNING id as chat_id, title as chat_title
        )
        -- Return all data in single row
        SELECT 
            na.attempt_id::text,
            nc.chat_id::text,
            nc.chat_title,
            sfd.scenario_id::text,
            sfd.scenario_name,
            sfd.problem_statement,
            sfd.needs_generation,
            -- Simulation metadata as JSONB
            jsonb_build_object(
                'id', sd.id::text,
                'title', sd.title,
                'description', sd.description,
                'department_id', sd.department_id::text,
                'active', sd.active,
                'default_simulation', sd.default_simulation,
                'practice_simulation', sd.practice_simulation,
                'hints_enabled', sd.hints_enabled,
                'input_guardrail_active', sd.input_guardrail_active,
                'output_guardrail_active', sd.output_guardrail_active,
                'image_input_active', sd.image_input_active,
                'rubric_id', sd.rubric_id::text
            ) as simulation_data,
            -- Scenario metadata as JSONB
            jsonb_build_object(
                'persona_id', sfd.persona_id::text,
                'persona_name', sfd.persona_name,
                'persona_system_prompt', sfd.system_prompt,
                'persona_temperature', sfd.temperature,
                'persona_reasoning', sfd.reasoning,
                'persona_color', sfd.persona_color,
                'persona_icon', sfd.persona_icon,
                'model_id', sfd.model_id::text,
                'model_name', sfd.model_name,
                'model_custom_model', sfd.custom_model,
                'provider_id', sfd.provider_id::text,
                'provider_name', sfd.provider_name,
                'provider_base_url', sfd.base_url,
                'provider_api_key', sfd.api_key,
                'documents', sfd.documents,
                'parameter_items', sfd.parameter_items,
                'active', sfd.active,
                'default_scenario', sfd.default_scenario,
                'generated', sfd.generated,
                'department_id', sfd.department_id::text
            ) as scenario_metadata
        FROM new_attempt na
        CROSS JOIN new_chat nc
        CROSS JOIN scenario_full_data sfd
        CROSS JOIN simulation_data sd
        """
        
        params = [simulation_id, infinite, profile_id, scenario_id_override, department_id]
        return (query, params)

    def update_chat_title(self) -> str:
        """Update simulation chat title.
        
        Params order: chat_id, title
        """
        return """
        UPDATE simulation_chats 
        SET title = $2, updated_at = now()
        WHERE id = $1
        """

    def get_simulation_detail_default_complete(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get default simulation detail in ONE query.

        Combines default simulation lookup with full detail fetch using CTEs.
        Consolidates 2 queries into 1.

        Args:
            profile_id: UUID of the profile for finding default simulation

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        ),
        default_simulation AS (
            SELECT s.id
            FROM simulations s
            JOIN user_departments ud ON ud.department_id = s.department_id
            WHERE s.active = true
            ORDER BY s.default_simulation DESC, s.created_at DESC
            LIMIT 1
        ),
        simulation_base AS (
            SELECT 
                s.id,
                s.title,
                s.description,
                s.department_id,
                s.active,
                s.default_simulation,
                s.practice_simulation,
                s.hints_enabled,
                s.objectives_enabled,
                s.input_guardrail_active,
                s.output_guardrail_active,
                s.image_input_active,
                s.rubric_id,
                stl.time_limit_seconds as time_limit
            FROM simulations s
            JOIN default_simulation ds ON s.id = ds.id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        ),
        user_context AS (
            SELECT role FROM profiles WHERE id = $1
        ),
        cohort_usage AS (
            SELECT COUNT(*) as cohort_count
            FROM cohort_simulations cs
            JOIN default_simulation ds ON cs.simulation_id = ds.id
        ),
        user_department_ids AS (
            SELECT ARRAY_AGG(id) as ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $1 AND d.active = true
        ),
        simulation_scenarios_base AS (
            SELECT 
                s.id as scenario_id,
                s.name,
                sps.problem_statement,
                ss.active,
                s.default_scenario,
                ss.position,
                COALESCE(
                    (SELECT ARRAY_AGG(DISTINCT spi.parameter_item_id)
                     FROM scenario_parameter_items spi
                     WHERE spi.scenario_id = s.id AND spi.active = true),
                    ARRAY[]::uuid[]
                ) as parameter_item_ids
            FROM scenarios s
            JOIN simulation_scenarios ss ON ss.scenario_id = s.id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            JOIN default_simulation ds ON ss.simulation_id = ds.id
            ORDER BY ss.position
        ),
        scenario_statistics AS (
            SELECT 
                ss.scenario_id,
                COALESCE(
                    (SELECT st.parent_id 
                     FROM scenario_tree st 
                     WHERE st.child_id = ss.scenario_id 
                       AND st.parent_id = st.child_id 
                     LIMIT 1),
                    ss.scenario_id
                ) as root_scenario_id,
                COUNT(DISTINCT sc.id) as usage_count,
                CASE 
                    WHEN COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END) > 0 
                    THEN ROUND(
                        (COUNT(DISTINCT CASE WHEN sc.completed = true AND scg.passed = true THEN sc.id END)::numeric / 
                         COUNT(DISTINCT CASE WHEN sc.completed = true THEN sc.id END)::numeric) * 100
                    )
                    ELSE 0 
                END as success_rate,
                MAX(sc.created_at) as last_used_date
            FROM simulation_scenarios ss
            JOIN default_simulation ds ON ss.simulation_id = ds.id
            LEFT JOIN simulation_chats sc ON (
                sc.scenario_id IN (
                    SELECT st2.child_id 
                    FROM scenario_tree st2 
                    WHERE st2.parent_id = COALESCE(
                        (SELECT st3.parent_id 
                         FROM scenario_tree st3 
                         WHERE st3.child_id = ss.scenario_id 
                           AND st3.parent_id = st3.child_id),
                        ss.scenario_id
                    )
                )
                OR sc.scenario_id = ss.scenario_id
            )
            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            GROUP BY ss.scenario_id
        ),
        scenarios_list_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'scenario_id', sb.scenario_id::text,
                        'title', sb.name,
                        'description', COALESCE(sb.problem_statement, ''),
                        'active', sb.active,
                        'default_scenario', COALESCE(sb.default_scenario, false),
                        'position', sb.position,
                        'parameter_item_ids', (
                            SELECT COALESCE(jsonb_agg(pid::text), '[]'::jsonb)
                            FROM unnest(sb.parameter_item_ids) as pid
                        ),
                        'usage_count', COALESCE(stats.usage_count, 0),
                        'success_rate', COALESCE(stats.success_rate, 0),
                        'last_used', stats.last_used_date,
                        'can_remove', COALESCE(stats.usage_count, 0) = 0
                    ) ORDER BY sb.position
                ),
                '[]'::jsonb
            ) as scenarios_list,
            COALESCE(ARRAY_AGG(sb.scenario_id::text), ARRAY[]::text[]) as scenario_ids
            FROM simulation_scenarios_base sb
            LEFT JOIN scenario_statistics stats ON stats.scenario_id = sb.scenario_id
        ),
        valid_scenarios_list AS (
            SELECT DISTINCT
                s.id,
                s.name,
                sps.problem_statement
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            CROSS JOIN user_department_ids udi
            JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
            WHERE s.department_id = ANY(udi.ids) 
              AND s.active = true
        ),
        valid_scenarios AS (
            SELECT ARRAY_AGG(id::text) as ids
            FROM valid_scenarios_list
        ),
        valid_rubrics_data AS (
            SELECT 
                r.id,
                r.name,
                COALESCE(r.description, '') as description
            FROM rubrics r, user_department_ids udi
            WHERE r.department_id = ANY(udi.ids) AND r.active = true
        ),
        rubric_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vr.id::text,
                    jsonb_build_object(
                        'name', vr.name,
                        'description', vr.description
                    )
                ),
                '{}'::jsonb
            ) as rubric_mapping,
            COALESCE(ARRAY_AGG(vr.id::text), ARRAY[]::text[]) as rubric_ids
            FROM valid_rubrics_data vr
        ),
        parameters_data AS (
            SELECT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.numerical
            FROM parameters p, user_department_ids udi
            WHERE p.department_id = ANY(udi.ids)
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pd.id::text,
                    jsonb_build_object(
                        'name', pd.name,
                        'description', pd.description,
                        'numerical', pd.numerical
                    )
                ),
                '{}'::jsonb
            ) as parameter_mapping
            FROM parameters_data pd
        ),
        parameter_items_data AS (
            SELECT 
                pi.id,
                pi.parameter_id,
                pi.name,
                COALESCE(pi.description, '') as description,
                p.name as parameter_name,
                pi.value
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.id IN (SELECT id FROM parameters_data)
        ),
        parameter_items_list_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', pid.id::text,
                        'parameter_id', pid.parameter_id::text,
                        'name', pid.name,
                        'description', pid.description
                    )
                ),
                '[]'::jsonb
            ) as parameter_items_list
            FROM parameter_items_data pid
        ),
        parameter_item_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pid.id::text,
                    jsonb_build_object(
                        'name', pid.name,
                        'description', pid.description,
                        'parameter_id', pid.parameter_id::text,
                        'parameter_name', pid.parameter_name,
                        'value', pid.value
                    )
                ),
                '{}'::jsonb
            ) as parameter_item_mapping
            FROM parameter_items_data pid
        ),
        scenario_persona_data AS (
            SELECT 
                sp.scenario_id,
                sp.persona_id,
                p.name as persona_name,
                COALESCE(p.description, '') as persona_description,
                p.color as persona_color,
                p.icon as persona_icon
            FROM scenario_personas sp
            JOIN personas p ON p.id = sp.persona_id
            WHERE sp.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sp.active = true
        ),
        scenario_documents_data AS (
            SELECT 
                sd.scenario_id,
                ARRAY_AGG(sd.document_id) as document_ids
            FROM scenario_documents sd
            WHERE sd.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND sd.active = true
            GROUP BY sd.scenario_id
        ),
        scenario_parameter_items_data AS (
            SELECT 
                spi.scenario_id,
                ARRAY_AGG(DISTINCT spi.parameter_item_id) as parameter_item_ids
            FROM scenario_parameter_items spi
            WHERE spi.scenario_id IN (SELECT id FROM valid_scenarios_list)
              AND spi.active = true
            GROUP BY spi.scenario_id
        ),
        all_document_ids AS (
            SELECT DISTINCT unnest(document_ids) as document_id
            FROM scenario_documents_data
        ),
        document_mapping_base AS (
            SELECT 
                d.id,
                d.name,
                d.type::text as description
            FROM documents d
            WHERE d.id IN (SELECT document_id FROM all_document_ids)
        ),
        scenario_mapping_complete AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    vsl.id::text,
                    jsonb_build_object(
                        'name', vsl.name,
                        'description', COALESCE(vsl.problem_statement, ''),
                        'persona_id', spd.persona_id::text,
                        'persona_mapping', CASE 
                            WHEN spd.persona_id IS NOT NULL THEN
                                jsonb_build_object(
                                    spd.persona_id::text,
                                    jsonb_build_object(
                                        'name', spd.persona_name,
                                        'description', spd.persona_description,
                                        'color', spd.persona_color,
                                        'icon', spd.persona_icon
                                    )
                                )
                            ELSE '{}'::jsonb
                        END,
                        'document_mapping', COALESCE(
                            (SELECT jsonb_object_agg(
                                dmb.id::text,
                                jsonb_build_object(
                                    'name', dmb.name,
                                    'description', dmb.description
                                )
                            )
                            FROM document_mapping_base dmb
                            WHERE dmb.id = ANY(sdd.document_ids)),
                            '{}'::jsonb
                        ),
                        'parameter_item_mapping', COALESCE(
                            (SELECT jsonb_object_agg(
                                pid.id::text,
                                jsonb_build_object(
                                    'name', pid.name,
                                    'description', pid.description,
                                    'parameter_id', pid.parameter_id::text,
                                    'parameter_name', pid.parameter_name
                                )
                            )
                            FROM parameter_items_data pid
                            WHERE pid.id = ANY(spid.parameter_item_ids)),
                            '{}'::jsonb
                        ),
                        'parameter_item_ids', COALESCE(
                            (SELECT jsonb_agg(pid::text)
                             FROM unnest(spid.parameter_item_ids) as pid),
                            '[]'::jsonb
                        ),
                        'document_ids', COALESCE(
                            (SELECT jsonb_agg(did::text)
                             FROM unnest(sdd.document_ids) as did),
                            '[]'::jsonb
                        )
                    )
                ),
                '{}'::jsonb
            ) as scenario_mapping
            FROM valid_scenarios_list vsl
            LEFT JOIN scenario_persona_data spd ON spd.scenario_id = vsl.id
            LEFT JOIN scenario_documents_data sdd ON sdd.scenario_id = vsl.id
            LEFT JOIN scenario_parameter_items_data spid ON spid.scenario_id = vsl.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, '')
                    )
                ),
                '{}'::jsonb
            ) as department_mapping,
            COALESCE(ARRAY_AGG(d.id::text), ARRAY[]::text[]) as department_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $1 AND d.active = true
        )
        SELECT 
            sb.title,
            sb.description,
            sb.department_id::text,
            sb.time_limit,
            sb.rubric_id::text,
            sb.active,
            sb.default_simulation,
            sb.practice_simulation,
            sb.hints_enabled,
            sb.objectives_enabled,
            sb.input_guardrail_active,
            sb.output_guardrail_active,
            sb.image_input_active,
            uc.role as user_role,
            COALESCE(cu.cohort_count, 0) as cohort_count,
            sld.scenarios_list,
            sld.scenario_ids,
            COALESCE(vs.ids, ARRAY[]::text[]) as valid_scenario_ids,
            COALESCE(rmd.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
            dmd.department_ids as valid_department_ids,
            smc.scenario_mapping,
            rmd.rubric_mapping,
            dmd.department_mapping,
            pmd.parameter_mapping,
            pimd.parameter_item_mapping,
            pild.parameter_items_list
        FROM simulation_base sb
        CROSS JOIN user_context uc
        LEFT JOIN cohort_usage cu ON true
        LEFT JOIN scenarios_list_data sld ON true
        LEFT JOIN valid_scenarios vs ON true
        LEFT JOIN rubric_mapping_data rmd ON true
        LEFT JOIN parameter_mapping_data pmd ON true
        LEFT JOIN parameter_item_mapping_data pimd ON true
        LEFT JOIN parameter_items_list_data pild ON true
        LEFT JOIN scenario_mapping_complete smc ON true
        LEFT JOIN department_mapping_data dmd ON true
        """
        return (query, [profile_id])

    def get_attempt_full_data_complete(self, attempt_id: str) -> tuple[str, list[Any]]:
        """Build optimized query to get complete attempt data in ONE query.

        Consolidates 12+ queries into 1 using CTEs and JSONB aggregations.
        Returns all attempt data including chats, messages, grades, rubrics,
        documents, and computed metrics (timer, aggregated results, dynamic rubrics).
        """
        query = """
        WITH attempt_base AS (
        SELECT 
            sa.id,
            sa.created_at,
            sa.simulation_id,
            sa.infinite_mode,
            sa.archived,
            s.id as sim_id,
            s.title as sim_title,
            s.description as sim_description,
            s.department_id as sim_department_id,
            s.active as sim_active,
            s.default_simulation as sim_default_simulation,
            s.practice_simulation as sim_practice_simulation,
            s.hints_enabled as sim_hints_enabled,
            s.objectives_enabled as sim_objectives_enabled,
            s.input_guardrail_active as sim_input_guardrail_active,
            s.output_guardrail_active as sim_output_guardrail_active,
            s.image_input_active as sim_image_input_active,
            stl.time_limit_seconds as sim_time_limit,
            s.rubric_id as sim_rubric_id,
            s.created_at as sim_created_at,
            s.updated_at as sim_updated_at
        FROM simulation_attempts sa
        JOIN simulations s ON s.id = sa.simulation_id
        LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        WHERE sa.id = $1
        ),
        attempt_profiles_data AS (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'profileId', ap.profile_id::text,
                        'attemptId', ap.attempt_id::text,
                        'active', ap.active
                    )
                ),
                '[]'::jsonb
            ) as attempt_profiles
            FROM attempt_profiles ap
            WHERE ap.attempt_id = $1
        ),
        chats_base AS (
        SELECT 
            sc.id,
            sc.created_at,
            sc.updated_at,
            sc.title,
            sc.scenario_id,
            sc.attempt_id,
            sc.completed,
            sc.trace_id,
            -- Add document IDs for this chat's scenario
            COALESCE(
                (SELECT array_agg(DISTINCT sd.document_id::text)
                 FROM scenario_documents sd
                 WHERE sd.scenario_id = sc.scenario_id AND sd.active = true),
                ARRAY[]::text[]
            ) as document_ids
        FROM simulation_chats sc
        WHERE sc.attempt_id = $1
        ORDER BY sc.created_at
        ),
        chat_ids_list AS (
            SELECT array_agg(id) as chat_ids
            FROM chats_base
        ),
        scenario_ids_list AS (
            SELECT array_agg(DISTINCT scenario_id) as scenario_ids
            FROM chats_base
        ),
        scenarios_data AS (
            SELECT 
                s.id,
                jsonb_build_object(
                    'id', s.id::text,
                    'name', s.name,
                    'problemStatement', sps.problem_statement,
                    'departmentId', s.department_id::text,
                    'active', s.active,
                    'personaId', CASE WHEN sp.persona_id IS NOT NULL THEN sp.persona_id::text ELSE NULL END,
                    'createdAt', s.created_at,
                    'updatedAt', s.updated_at,
                    'generated', s.generated,
                    'defaultScenario', s.default_scenario,
                    'objectives', COALESCE(
                        (SELECT jsonb_agg(so.objective ORDER BY so.idx)
                         FROM scenario_objectives so
                         WHERE so.scenario_id = s.id),
                        '[]'::jsonb
                    )
                ) as scenario_data
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            CROSS JOIN scenario_ids_list sil
            LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
            WHERE s.id = ANY(sil.scenario_ids)
        ),
        messages_grouped AS (
            SELECT 
                sm.chat_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', sm.id::text,
                            'createdAt', sm.created_at,
                            'updatedAt', sm.updated_at,
                            'chatId', sm.chat_id::text,
                            'content', sm.content,
                            'type', sm.type,
                            'completed', sm.completed
                        ) ORDER BY sm.created_at
                    ),
                    '[]'::jsonb
                ) as messages
            FROM simulation_messages sm
            CROSS JOIN chat_ids_list cil
            WHERE sm.chat_id = ANY(cil.chat_ids)
            GROUP BY sm.chat_id
        ),
        hints_data AS (
            SELECT 
                sm.chat_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'messageId', sm.id::text,
                            'hints', COALESCE(
                                (SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'simulationMessageId', sh.simulation_message_id::text,
                                        'hint', sh.hint,
                                        'idx', sh.idx,
                                        'createdAt', sh.created_at
                                    ) ORDER BY sh.idx
                                )
                                FROM simulation_hints sh
                                WHERE sh.simulation_message_id = sm.id),
                                '[]'::jsonb
                            )
                        )
                    ) FILTER (WHERE sm.type = 'response'),
                    '[]'::jsonb
                ) as hints
            FROM simulation_messages sm
            CROSS JOIN chat_ids_list cil
            CROSS JOIN attempt_base ab
            WHERE sm.chat_id = ANY(cil.chat_ids)
              AND ab.sim_practice_simulation = true
            GROUP BY sm.chat_id
        ),
        grades_data AS (
                SELECT 
                scg.simulation_chat_id as chat_id,
                jsonb_build_object(
                    'id', scg.id::text,
                    'createdAt', scg.created_at,
                    'simulationChatId', scg.simulation_chat_id::text,
                    'rubricId', scg.rubric_id::text,
                    'description', scg.description,
                    'passed', scg.passed,
                    'score', scg.score,
                    'timeTaken', scg.time_taken
                ) as grade
            FROM simulation_chat_grades scg
            CROSS JOIN chat_ids_list cil
            WHERE scg.simulation_chat_id = ANY(cil.chat_ids)
        ),
        feedbacks_grouped AS (
            SELECT 
                scf.simulation_chat_grade_id as grade_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', scf.id::text,
                            'createdAt', scf.created_at,
                            'standardId', scf.standard_id::text,
                            'simulationChatGradeId', scf.simulation_chat_grade_id::text,
                            'total', scf.total,
                            'feedback', scf.feedback
                        )
                    ),
                    '[]'::jsonb
                ) as feedbacks
            FROM simulation_chat_feedbacks scf
            WHERE scf.simulation_chat_grade_id IN (
                SELECT (grade->>'id')::uuid
                FROM grades_data
            )
            GROUP BY scf.simulation_chat_grade_id
        ),
        rubric_standard_groups AS (
            SELECT 
                sg.id,
                sg.name,
                sg.short_name,
                sg.points,
                sg.pass_points,
                sg.description,
                sg.rubric_id
            FROM standard_groups sg
            CROSS JOIN attempt_base ab
            WHERE ab.sim_rubric_id IS NOT NULL
              AND sg.rubric_id = ab.sim_rubric_id
        ),
        rubric_standards_grouped AS (
                SELECT 
                s.standard_group_id,
                array_agg(s.id::text) as standard_ids,
                jsonb_agg(
                    jsonb_build_object(
                        'id', s.id::text,
                        'name', s.name,
                        'points', s.points,
                        'standardGroupId', s.standard_group_id::text
                    )
                ) as standards_list
            FROM standards s
            WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups)
            GROUP BY s.standard_group_id
        ),
        standards_mapping_merged AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.name,
                        'description', COALESCE(s.description, ''),
                        'points', s.points
                    )
                ),
                '{}'::jsonb
            ) as standards_mapping
            FROM standards s
            WHERE s.standard_group_id IN (SELECT id FROM rubric_standard_groups)
        ),
        rubric_structure_complete AS (
            SELECT 
                CASE 
                    WHEN EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                        jsonb_build_object(
                            'standardGroups', (
                                SELECT jsonb_object_agg(rsg.id::text, rsgroup.standard_ids)
                                FROM rubric_standard_groups rsg
                                LEFT JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id
                            ),
                            'standardGroupsMapping', (
                                SELECT jsonb_object_agg(
                                    rsg.id::text,
                                    jsonb_build_object(
                                        'name', rsg.name,
                                        'description', COALESCE(rsg.description, ''),
                                        'points', rsg.points,
                                        'passPoints', rsg.pass_points
                                    )
                                )
                                FROM rubric_standard_groups rsg
                            ),
                            'standardsMapping', smm.standards_mapping
                        )
                    ELSE NULL
                END as rubric_structure
            FROM standards_mapping_merged smm
        ),
        scenario_documents_data AS (
            SELECT COALESCE(
                jsonb_agg(DISTINCT
                    jsonb_build_object(
                        'document_id', d.id::text,
                        'name', d.name,
                        'type', d.type,
                        'updatedAt', d.updated_at,
                        'extension', SUBSTRING(d.file_path FROM '\\.([^\\.]+)$'),
                        'scenario_ids', COALESCE(
                            (SELECT array_agg(DISTINCT st.parent_id::text)
                             FROM scenario_documents sd2
                             JOIN scenario_tree st ON st.child_id = sd2.scenario_id AND st.parent_id = st.child_id
                             WHERE sd2.document_id = d.id AND sd2.active = true),
                            ARRAY[]::text[]
                        ),
                        'can_edit', false,
                        'can_delete', false,
                        'active', d.active,
                        'department_id', d.department_id::text,
                        'file_path', d.file_path,
                        'mime_type', d.mime_type,
                        'parameter_item_ids', COALESCE(
                            (SELECT array_agg(DISTINCT dpi.parameter_item_id::text)
                             FROM document_parameter_items dpi
                             WHERE dpi.document_id = d.id AND dpi.active = true),
                            ARRAY[]::text[]
                        )
                    )
                ),
                '[]'::jsonb
            ) as scenario_documents
            FROM documents d
            JOIN scenario_documents sd ON sd.document_id = d.id
            CROSS JOIN scenario_ids_list sil
            WHERE sd.scenario_id = ANY(sil.scenario_ids) AND d.active = true
        ),
        skill_scores_per_chat AS (
            SELECT 
                gd.chat_id,
                rsg.id as group_id,
                rsg.name as group_name,
                rsg.short_name,
                AVG((fb->>'total')::numeric) as avg_score,
                MAX((std->>'points')::numeric) as max_points,
                string_agg(COALESCE(fb->>'feedback', ''), '; ') as feedbacks_text
            FROM grades_data gd
            LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
            CROSS JOIN rubric_standard_groups rsg
            JOIN rubric_standards_grouped rsgroup ON rsgroup.standard_group_id = rsg.id
            CROSS JOIN LATERAL jsonb_array_elements(rsgroup.standards_list) std
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fg.feedbacks, '[]'::jsonb)) fb
            WHERE (fb->>'standardId')::text = (std->>'id')::text
            GROUP BY gd.chat_id, rsg.id, rsg.name, rsg.short_name
        ),
        dynamic_rubric_per_chat AS (
            SELECT 
                gd.chat_id,
                CASE 
                    WHEN gd.grade IS NOT NULL AND EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                        jsonb_build_object(
                            'chatId', gd.chat_id::text,
                            'score', (gd.grade->>'score')::numeric,
                            'passed', (gd.grade->>'passed')::boolean,
                            'timeTaken', (gd.grade->>'timeTaken')::integer,
                            'skillScores', COALESCE(
                                (SELECT jsonb_object_agg(
                                    group_name,
                                    ROUND((avg_score / max_points) * 5)
                                )
                                FROM skill_scores_per_chat
                                WHERE chat_id = gd.chat_id),
                                '{}'::jsonb
                            ),
                            'skillFeedbacks', COALESCE(
                                (SELECT jsonb_object_agg(short_name, feedbacks_text)
                                FROM skill_scores_per_chat
                                WHERE chat_id = gd.chat_id),
                                '{}'::jsonb
                            ),
                            'totalPossiblePoints', COALESCE(
                                (SELECT SUM(points) FROM rubric_standard_groups),
                                0
                            )
                        )
                    ELSE NULL
                END as dynamic_rubric
            FROM grades_data gd
        ),
        max_scores_per_group_chat AS (
            SELECT 
                gd.chat_id,
                s.standard_group_id,
                MAX((fb->>'total')::numeric) as max_score,
                rsg.pass_points
            FROM grades_data gd
            LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(fg.feedbacks, '[]'::jsonb)) fb
            JOIN standards s ON s.id = ((fb->>'standardId')::uuid)
            JOIN rubric_standard_groups rsg ON rsg.id = s.standard_group_id
            GROUP BY gd.chat_id, s.standard_group_id, rsg.pass_points
        ),
        grading_state_per_chat AS (
            SELECT 
                gd.chat_id,
                CASE 
                    WHEN gd.grade IS NOT NULL AND fg.feedbacks IS NOT NULL 
                         AND EXISTS (SELECT 1 FROM rubric_standard_groups) THEN
                        jsonb_build_object(
                            'achievedStandards', COALESCE(
                                (SELECT jsonb_object_agg(
                                    (fb->>'standardId')::text,
                                    true  -- Simply mark standards that have feedback as achieved
                                )
                                FROM jsonb_array_elements(fg.feedbacks) fb),
                                '{}'::jsonb
                            ),
                            'passedStandards', COALESCE(
                                (SELECT jsonb_object_agg(
                                    (fb->>'standardId')::text,
                                    (fb->>'total')::numeric >= mspgc.pass_points
                                )
                                FROM jsonb_array_elements(fg.feedbacks) fb
                                JOIN standards s ON s.id = ((fb->>'standardId')::uuid)
                                LEFT JOIN max_scores_per_group_chat mspgc 
                                    ON mspgc.chat_id = gd.chat_id 
                                    AND mspgc.standard_group_id = s.standard_group_id),
                                '{}'::jsonb
                            ),
                            'feedbackByStandardId', COALESCE(
                                (SELECT jsonb_object_agg(
                                    (fb->>'standardId')::text,
                                    (fb->>'feedback')::text
                                )
                                FROM jsonb_array_elements(fg.feedbacks) fb),
                                '{}'::jsonb
                            ),
                            'gradeDescription', COALESCE(gd.grade->>'description', '')
                        )
                    ELSE NULL
                END as grading_state
            FROM grades_data gd
            LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
        ),
        chats_with_all_data AS (
            SELECT 
                cb.id as chat_id,
                jsonb_build_object(
                    'chat', jsonb_build_object(
                        'id', cb.id::text,
                        'createdAt', cb.created_at,
                        'updatedAt', cb.updated_at,
                        'title', cb.title,
                        'scenarioId', cb.scenario_id::text,
                        'attemptId', cb.attempt_id::text,
                        'completed', cb.completed,
                        'completedAt', CASE 
                            WHEN cb.completed AND gd.grade IS NOT NULL 
                            THEN gd.grade->>'createdAt'
                            ELSE NULL 
                        END,
                        'traceId', CASE WHEN cb.trace_id IS NOT NULL THEN cb.trace_id::text ELSE NULL END,
                        'documentIds', COALESCE(
                            (SELECT jsonb_agg(did)
                             FROM unnest(cb.document_ids) as did),
                            '[]'::jsonb
                        )
                    ),
                    'scenario', sd.scenario_data,
                    'messages', COALESCE(mg.messages, '[]'::jsonb),
                    'hints', COALESCE(hd.hints, '[]'::jsonb),
                    'grade', gd.grade,
                    'feedbacks', COALESCE(fg.feedbacks, '[]'::jsonb),
                    'dynamicRubric', drpc.dynamic_rubric,
                    'gradingState', gspc.grading_state
                ) as chat_data,
                cb.completed,
                cb.created_at,
                gd.grade
            FROM chats_base cb
            LEFT JOIN scenarios_data sd ON sd.id = cb.scenario_id
            LEFT JOIN messages_grouped mg ON mg.chat_id = cb.id
            LEFT JOIN hints_data hd ON hd.chat_id = cb.id
            LEFT JOIN grades_data gd ON gd.chat_id = cb.id
            LEFT JOIN feedbacks_grouped fg ON fg.grade_id = (gd.grade->>'id')::uuid
            LEFT JOIN dynamic_rubric_per_chat drpc ON drpc.chat_id = cb.id
            LEFT JOIN grading_state_per_chat gspc ON gspc.chat_id = cb.id
        ),
        aggregated_results_data AS (
            SELECT 
                CASE 
                    WHEN COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL) > 0 THEN
                        jsonb_build_object(
                            'totalChats', COUNT(*) FILTER (WHERE completed = true AND grade IS NOT NULL),
                            'passedChats', COUNT(*) FILTER (WHERE (grade->>'passed')::boolean = true),
                            'averageScore', ROUND(
                                AVG((grade->>'score')::numeric) FILTER (WHERE completed = true AND grade IS NOT NULL),
                                1
                            ),
                            'totalTime', SUM((grade->>'timeTaken')::integer) FILTER (WHERE completed = true AND grade IS NOT NULL),
                            'overallPassed', BOOL_AND((grade->>'passed')::boolean) FILTER (WHERE completed = true AND grade IS NOT NULL)
                        )
                    ELSE NULL
                END as aggregated_results
            FROM chats_with_all_data
        ),
        elapsed_time_calc AS (
            SELECT 
                COALESCE(
                    SUM(
                        CASE 
                            WHEN cwad.completed AND cwad.grade IS NOT NULL THEN
                                (cwad.grade->>'timeTaken')::integer
                            WHEN cwad.completed THEN
                                EXTRACT(EPOCH FROM (
                                    (cwad.grade->>'createdAt')::timestamp - cwad.created_at
                                ))::integer
                            ELSE
                                EXTRACT(EPOCH FROM (NOW() - cwad.created_at))::integer
                        END
                    ),
                    0
                ) as total_elapsed
            FROM chats_with_all_data cwad
        ),
        timer_data AS (
            SELECT 
                jsonb_build_object(
                    'elapsed', etc.total_elapsed,
                    'remaining', CASE 
                        WHEN ab.infinite_mode AND ab.sim_time_limit IS NOT NULL THEN
                            GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0)
                        WHEN ab.sim_time_limit IS NOT NULL THEN
                            (ab.sim_time_limit * 60) - etc.total_elapsed
                        ELSE NULL
                    END,
                    'expired', CASE 
                        WHEN ab.infinite_mode AND ab.sim_time_limit IS NOT NULL THEN
                            (GREATEST((ab.sim_time_limit * 60) - etc.total_elapsed, 0) <= 0)
                        ELSE false
                    END
                ) as timer
            FROM attempt_base ab
            CROSS JOIN elapsed_time_calc etc
        ),
        metadata_computed AS (
            SELECT 
                COALESCE(
                    (SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
                     FROM chats_with_all_data
                     WHERE completed = false
                     LIMIT 1),
                    0
                ) as current_chat_index,
                COUNT(*)::integer as expected_chat_count,
                COUNT(*) = 1 as is_single_chat_attempt,
                COALESCE(
                    (SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
                     FROM chats_with_all_data
                     WHERE completed = false
                     LIMIT 1),
                    0
                ) = COUNT(*) - 1 as is_last_attempt,
                BOOL_AND(completed) as show_results
            FROM chats_with_all_data
        )
        SELECT 
            jsonb_build_object(
                'id', ab.id::text,
                'createdAt', ab.created_at,
                'simulationId', ab.simulation_id::text,
                'infiniteMode', ab.infinite_mode,
                'archived', ab.archived
            ) as attempt,
            jsonb_build_object(
                'id', ab.sim_id::text,
                'title', ab.sim_title,
                'description', ab.sim_description,
                'departmentId', ab.sim_department_id::text,
                'active', ab.sim_active,
                'defaultSimulation', ab.sim_default_simulation,
                'practiceSimulation', ab.sim_practice_simulation,
                'hintsEnabled', ab.sim_hints_enabled,
                'objectivesEnabled', ab.sim_objectives_enabled,
                'inputGuardrailActive', ab.sim_input_guardrail_active,
                'outputGuardrailActive', ab.sim_output_guardrail_active,
                'imageInputActive', ab.sim_image_input_active,
                'timeLimit', ab.sim_time_limit,
                'rubricId', CASE WHEN ab.sim_rubric_id IS NOT NULL THEN ab.sim_rubric_id::text ELSE NULL END,
                'createdAt', ab.sim_created_at,
                'updatedAt', ab.sim_updated_at
            ) as simulation,
            apd.attempt_profiles as "attemptProfiles",
            COALESCE(
                (SELECT jsonb_agg(chat_data ORDER BY created_at) FROM chats_with_all_data),
                '[]'::jsonb
            ) as chats,
            sdd.scenario_documents as "scenarioDocuments",
            ard.aggregated_results as "aggregatedResults",
            td.timer,
            md.current_chat_index as "currentChatIndex",
            md.expected_chat_count as "expectedChatCount",
            md.is_single_chat_attempt as "isSingleChatAttempt",
            md.is_last_attempt as "isLastAttempt",
            md.show_results as "showResults",
            NOT (COALESCE((td.timer->>'expired')::boolean, false) OR md.show_results) as "isActive",
            rsc.rubric_structure as "rubricStructure"
        FROM attempt_base ab
        CROSS JOIN attempt_profiles_data apd
        CROSS JOIN scenario_documents_data sdd
        CROSS JOIN aggregated_results_data ard
        CROSS JOIN timer_data td
        CROSS JOIN metadata_computed md
        LEFT JOIN rubric_structure_complete rsc ON true
        """
        return (query, [attempt_id])


async def get_attempt_full_data(conn: Any, attempt_id: str) -> dict[str, Any]:
    """Get complete attempt data with all related entities and computed values.
    
    Now uses a single optimized SQL query instead of 12+ sequential queries.
    """
    import json
    
    queries = SimulationQueries()
    query, params = queries.get_attempt_full_data_complete(attempt_id)
    
    result = await conn.fetchrow(query, *params)
    
    if not result:
        raise ValueError(f"Attempt {attempt_id} not found")
    
    # Parse JSONB fields from strings to Python objects
    # asyncpg returns JSONB as serialized JSON strings, so we need to parse them
    return {
        "attempt": json.loads(result["attempt"]) if isinstance(result["attempt"], str) else result["attempt"],
        "simulation": json.loads(result["simulation"]) if isinstance(result["simulation"], str) else result["simulation"],
        "attemptProfiles": json.loads(result["attemptProfiles"]) if isinstance(result["attemptProfiles"], str) else result["attemptProfiles"],
        "chats": json.loads(result["chats"]) if isinstance(result["chats"], str) else result["chats"],
        "scenarioDocuments": json.loads(result["scenarioDocuments"]) if isinstance(result["scenarioDocuments"], str) else result["scenarioDocuments"],
        "aggregatedResults": json.loads(result["aggregatedResults"]) if result["aggregatedResults"] and isinstance(result["aggregatedResults"], str) else result["aggregatedResults"],
        "timer": json.loads(result["timer"]) if isinstance(result["timer"], str) else result["timer"],
        "currentChatIndex": result["currentChatIndex"],
        "expectedChatCount": result["expectedChatCount"],
        "isSingleChatAttempt": result["isSingleChatAttempt"],
        "isLastAttempt": result["isLastAttempt"],
        "showResults": result["showResults"],
        "isActive": result["isActive"],
        "rubricStructure": json.loads(result["rubricStructure"]) if result["rubricStructure"] and isinstance(result["rubricStructure"], str) else result["rubricStructure"],
    }
