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
                COUNT(*) as total_cohort_links
            FROM cohort_simulations cs
            GROUP BY cs.simulation_id
        ),
        simulation_data AS (
            SELECT 
                s.id as simulation_id,
                s.title as name,
                s.description,
                stl.time_limit_seconds as time_limit,
                s.active,
                s.default_simulation,
                s.practice_simulation,
                s.rubric_id,
                COALESCE(ss.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
                COALESCE(ss.num_scenarios, 0) as num_scenarios,
                COALESCE(sa.attempt_count, 0) as attempt_count,
                COALESCE(sacl.active_cohort_count, 0) as active_cohort_count,
                COALESCE(salcl.total_cohort_links, 0) as total_cohort_links
            FROM simulations s
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
            LEFT JOIN simulation_attempts sa ON sa.simulation_id = s.id
            LEFT JOIN simulation_active_cohort_links sacl ON sacl.simulation_id = s.id
            LEFT JOIN simulation_all_cohort_links salcl ON salcl.simulation_id = s.id
            WHERE s.department_id = ANY($1)
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
                        'description', COALESCE(s.problem_statement, ''),
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
                ) FILTER (WHERE s.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_scenario_ids asi
            LEFT JOIN scenarios s ON s.id = asi.scenario_id
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
                WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                     AND (sd.default_simulation = false OR up.role = 'superadmin')
                     AND sd.active_cohort_count = 0
                THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                     AND (sd.default_simulation = false OR up.role = 'superadmin')
                     AND sd.total_cohort_links = 0
                THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate,
            sm.mapping as scenario_mapping,
            rm.mapping as rubric_mapping
        FROM simulation_data sd
        CROSS JOIN user_profile up
        CROSS JOIN scenario_mapping_data sm
        CROSS JOIN rubric_mapping_data rm
        ORDER BY sd.name
        """

        return (query, [department_ids, profile_id])

    def get_simulation_by_id(self, simulation_id: str) -> tuple[str, list[Any]]:
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
        SELECT s.id 
        FROM scenarios s
        WHERE s.department_id = ANY($1) 
          AND s.active = true
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
        ORDER BY s.name
        """
        return (query, [dept_ids])

    def get_valid_rubrics(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid rubrics."""
        query = """
        SELECT id, name, COALESCE(description, '') as description FROM rubrics 
        WHERE department_id = ANY($1) AND active = true
        ORDER BY name
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
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
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
        return (query, [profile_id])

    def create_simulation(self) -> str:
        """Build query to create simulation.

        Params order: title, description, department_id, active, default_simulation,
        practice_simulation, hints_enabled, input_guardrail_active, output_guardrail_active,
        image_input_active, rubric_id
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
            input_guardrail_active,
            output_guardrail_active,
            image_input_active,
            rubric_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        """

    def insert_simulation_scenario(self) -> str:
        """Build query to insert simulation scenario.

        Params order: simulation_id, scenario_id, active
        """
        return """
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active)
        VALUES ($1, $2, $3)
        """

    def get_simulation_name(self, simulation_id: str) -> tuple[str, list[Any]]:
        """Build query to get simulation name."""
        query = "SELECT title FROM simulations WHERE id = $1"
        return (query, [simulation_id])

    def update_simulation(self) -> str:
        """Build query to update simulation.

        Params order: title, description, department_id, active, default_simulation,
        practice_simulation, hints_enabled, input_guardrail_active, output_guardrail_active,
        image_input_active, rubric_id, simulation_id
        """
        return """
        UPDATE simulations SET
            title = $1,
            description = $2,
            department_id = $3,
            active = $4,
            default_simulation = $5,
            practice_simulation = $6,
            hints_enabled = $7,
            input_guardrail_active = $8,
            output_guardrail_active = $9,
            image_input_active = $10,
            rubric_id = $11,
            updated_at = NOW()
        WHERE id = $12
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

        Params order: title, description, department_id, hints_enabled, input_guardrail_active,
        output_guardrail_active, image_input_active, rubric_id
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
            $8
        )
        RETURNING id
        """

    def copy_simulation_scenarios(self) -> str:
        """Build query to copy simulation scenarios.

        Params order: new_simulation_id, original_simulation_id
        """
        return """
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active)
        SELECT $1, scenario_id, active
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
            s.*,
            COALESCE(ARRAY_AGG(DISTINCT sd.document_id) FILTER (WHERE sd.document_id IS NOT NULL), ARRAY[]::uuid[]) as document_ids,
            COALESCE(ARRAY_AGG(DISTINCT spi.parameter_item_id) FILTER (WHERE spi.parameter_item_id IS NOT NULL), ARRAY[]::uuid[]) as parameter_item_ids,
            (SELECT persona_id FROM scenario_personas WHERE scenario_id = s.id AND active = true LIMIT 1) as persona_id
        FROM scenarios s
        LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
        LEFT JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
        WHERE s.id = $1
        GROUP BY s.id
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
            s.problem_statement,
            s.active,
            s.default_scenario,
            ss.position
        FROM scenarios s
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
                    'problem_statement', sc.problem_statement,
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
        WITH simulation_base AS (
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
                s.problem_statement,
                s.active,
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
            WHERE ss.simulation_id = $1 AND ss.active = true
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
                s.problem_statement
            FROM scenarios s
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
                COALESCE(p.description, '') as description
            FROM parameters p, user_department_ids udi
            WHERE p.department_id = ANY(udi.ids)
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pd.id::text,
                    jsonb_build_object(
                        'name', pd.name,
                        'description', pd.description
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
                p.name as parameter_name
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
                        'parameter_name', pid.parameter_name
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


async def get_attempt_full_data(conn: Any, attempt_id: str) -> dict[str, Any]:
    """Get complete attempt data with all related entities and computed values."""
    from datetime import datetime
    from typing import Any

    # Convert attempt_id to string for SQL
    attempt_id_str = str(attempt_id)

    # 1. Get attempt and simulation
    attempt_result = await conn.fetchrow(
        """
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
    """,
        attempt_id_str,
    )

    if not attempt_result:
        raise ValueError(f"Attempt {attempt_id} not found")

    attempt = {
        "id": str(attempt_result["id"]),
        "createdAt": attempt_result["created_at"].isoformat(),
        "simulationId": str(attempt_result["simulation_id"]),
        "infiniteMode": attempt_result["infinite_mode"],
        "archived": attempt_result["archived"],
    }

    simulation = {
        "id": str(attempt_result["sim_id"]),
        "title": attempt_result["sim_title"],
        "description": attempt_result["sim_description"],
        "departmentId": str(attempt_result["sim_department_id"]),
        "active": attempt_result["sim_active"],
        "defaultSimulation": attempt_result["sim_default_simulation"],
        "practiceSimulation": attempt_result["sim_practice_simulation"],
        "hintsEnabled": attempt_result["sim_hints_enabled"],
        "inputGuardrailActive": attempt_result["sim_input_guardrail_active"],
        "outputGuardrailActive": attempt_result["sim_output_guardrail_active"],
        "imageInputActive": attempt_result["sim_image_input_active"],
        "timeLimit": attempt_result["sim_time_limit"],
        "rubricId": str(attempt_result["sim_rubric_id"])
        if attempt_result["sim_rubric_id"]
        else None,
        "createdAt": attempt_result["sim_created_at"].isoformat(),
        "updatedAt": attempt_result["sim_updated_at"].isoformat(),
    }

    # 2. Get attempt profiles
    attempt_profiles_result = await conn.fetch(
        """
        SELECT profile_id, attempt_id, active
        FROM attempt_profiles
        WHERE attempt_id = $1
    """,
        attempt_id_str,
    )

    attempt_profiles = [
        {
            "profileId": str(row["profile_id"]),
            "attemptId": str(row["attempt_id"]),
            "active": row["active"],
        }
        for row in attempt_profiles_result
    ]

    # 3. Get all chats for this attempt
    chats_result = await conn.fetch(
        """
        SELECT 
            sc.id,
            sc.created_at,
            sc.updated_at,
            sc.title,
            sc.scenario_id,
            sc.attempt_id,
            sc.completed,
            sc.trace_id
        FROM simulation_chats sc
        WHERE sc.attempt_id = $1
        ORDER BY sc.created_at
    """,
        attempt_id_str,
    )

    chat_ids = [str(row["id"]) for row in chats_result]
    scenario_ids = list(set([str(row["scenario_id"]) for row in chats_result]))

    # 4. Get all scenarios
    scenarios = {}
    if scenario_ids:
        scenarios_result = await conn.fetch(
            """
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
            WHERE id = ANY($1::uuid[])
        """,
            scenario_ids,
        )

        scenarios = {
            str(row["id"]): {
                "id": str(row["id"]),
                "name": row["name"],
                "problemStatement": row["problem_statement"],
                "departmentId": str(row["department_id"]),
                "active": row["active"],
                "personaId": str(row["persona_id"]) if row["persona_id"] else None,
                "createdAt": row["created_at"].isoformat(),
                "updatedAt": row["updated_at"].isoformat(),
                "generated": row["generated"],
                "defaultScenario": row["default_scenario"],
            }
            for row in scenarios_result
        }

    # 5. Get all messages for all chats
    messages_by_chat: dict[str, list[dict[str, Any]]] = {}
    if chat_ids:
        messages_result = await conn.fetch(
            """
            SELECT 
                id,
                created_at,
                updated_at,
                chat_id,
                content,
                type,
                completed
            FROM simulation_messages
            WHERE chat_id = ANY($1::uuid[])
            ORDER BY created_at
        """,
            chat_ids,
        )

        for row in messages_result:
            chat_id = str(row["chat_id"])
            if chat_id not in messages_by_chat:
                messages_by_chat[chat_id] = []
            messages_by_chat[chat_id].append(
                {
                    "id": str(row["id"]),
                    "createdAt": row["created_at"].isoformat(),
                    "updatedAt": row["updated_at"].isoformat(),
                    "chatId": chat_id,
                    "content": row["content"],
                    "type": row["type"],
                    "completed": row["completed"],
                }
            )

    # 6. Get all hints for practice simulations
    hints_by_message: dict[str, list[dict[str, Any]]] = {}
    if simulation["practiceSimulation"] and messages_by_chat:
        all_message_ids = []
        for messages in messages_by_chat.values():
            all_message_ids.extend(
                [msg["id"] for msg in messages if msg["type"] == "response"]
            )

        if all_message_ids:
            hints_result = await conn.fetch(
                """
                SELECT 
                    simulation_message_id,
                    idx,
                    hint,
                    created_at
                FROM simulation_hints
                WHERE simulation_message_id = ANY($1::uuid[])
                ORDER BY simulation_message_id, idx
            """,
                all_message_ids,
            )

            for row in hints_result:
                message_id = str(row["simulation_message_id"])
                if message_id not in hints_by_message:
                    hints_by_message[message_id] = []
                hints_by_message[message_id].append(
                    {
                        "id": str(row["id"]),
                        "simulationMessageId": message_id,
                        "hint": row["hint"],
                        "createdAt": row["created_at"].isoformat(),
                    }
                )

    # 7. Get grades and feedbacks
    grades_by_chat: dict[str, dict[str, Any]] = {}
    feedbacks_by_grade: dict[str, list[dict[str, Any]]] = {}
    if chat_ids:
        grades_result = await conn.fetch(
            """
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
            WHERE simulation_chat_id = ANY($1::uuid[])
        """,
            chat_ids,
        )

        grade_ids = []
        for row in grades_result:
            chat_id = str(row["simulation_chat_id"])
            grade_id = str(row["id"])
            grade_ids.append(grade_id)
            grades_by_chat[chat_id] = {
                "id": grade_id,
                "createdAt": row["created_at"].isoformat(),
                "simulationChatId": chat_id,
                "rubricId": str(row["rubric_id"]),
                "description": row["description"],
                "passed": row["passed"],
                "score": row["score"],
                "timeTaken": row["time_taken"],
            }

        # Get feedbacks
        if grade_ids:
            feedbacks_result = await conn.fetch(
                """
                SELECT 
                    id,
                    created_at,
                    standard_id,
                    simulation_chat_grade_id,
                    total,
                    feedback
                FROM simulation_chat_feedbacks
                WHERE simulation_chat_grade_id = ANY($1::uuid[])
            """,
                grade_ids,
            )

            for row in feedbacks_result:
                grade_id = str(row["simulation_chat_grade_id"])
                if grade_id not in feedbacks_by_grade:
                    feedbacks_by_grade[grade_id] = []
                feedbacks_by_grade[grade_id].append(
                    {
                        "id": str(row["id"]),
                        "createdAt": row["created_at"].isoformat(),
                        "standardId": str(row["standard_id"]),
                        "simulationChatGradeId": grade_id,
                        "total": row["total"],
                        "feedback": row["feedback"],
                    }
                )

    # 8. Get rubric structure (standard groups and standards)
    standard_groups: dict[str, dict[str, Any]] = {}
    standards_by_group: dict[str, list[dict[str, Any]]] = {}
    # For TableRubric component
    rubric_structure_groups: dict[str, list[str]] = {}
    rubric_structure_groups_mapping: dict[str, dict[str, Any]] = {}
    rubric_structure_standards_mapping: dict[str, dict[str, Any]] = {}

    if simulation["rubricId"]:
        # Get standard groups
        groups_result = await conn.fetch(
            """
            SELECT 
                id,
                name,
                short_name,
                points,
                pass_points,
                description,
                rubric_id
            FROM standard_groups
            WHERE rubric_id = $1
        """,
            simulation["rubricId"],
        )

        group_ids = []
        for row in groups_result:
            group_id = str(row["id"])
            group_ids.append(group_id)
            standard_groups[group_id] = {
                "id": group_id,
                "name": row["name"],
                "shortName": row["short_name"],
                "points": row["points"],
                "rubricId": str(row["rubric_id"]),
            }
            # Build mapping for TableRubric
            rubric_structure_groups_mapping[group_id] = {
                "name": row["name"],
                "description": row["description"] or "",
                "points": row["points"],
                "passPoints": row["pass_points"],
            }

        # Get standards
        if group_ids:
            standards_result = await conn.fetch(
                """
                SELECT 
                    id,
                    name,
                    description,
                    points,
                    standard_group_id
                FROM standards
                WHERE standard_group_id = ANY($1::uuid[])
            """,
                group_ids,
            )

            for row in standards_result:
                group_id = str(row["standard_group_id"])
                standard_id = str(row["id"])

                if group_id not in standards_by_group:
                    standards_by_group[group_id] = []
                standards_by_group[group_id].append(
                    {
                        "id": standard_id,
                        "name": row["name"],
                        "points": row["points"],
                        "standardGroupId": group_id,
                    }
                )

                # Build structure for TableRubric
                if group_id not in rubric_structure_groups:
                    rubric_structure_groups[group_id] = []
                rubric_structure_groups[group_id].append(standard_id)

                # Build standards mapping for TableRubric
                rubric_structure_standards_mapping[standard_id] = {
                    "name": row["name"],
                    "description": row["description"] or "",
                    "points": row["points"],
                }

    # 9. Get documents
    # Get unique department IDs from scenarios
    dept_ids = list(
        set(
            [scenarios[sid]["departmentId"] for sid in scenario_ids if sid in scenarios]
        )
    )

    department_documents = []
    scenario_documents = []
    if dept_ids:
        # Get all department documents
        dept_docs_result = await conn.fetch(
            """
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
            WHERE department_id = ANY($1::uuid[]) AND active = true
        """,
            dept_ids,
        )

        department_documents = [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "title": row["name"],  # Use name as title
                "description": "",  # Documents don't have description in schema
                "filePath": row["file_path"],
                "type": row["type"],
                "classified": row["classified"],
                "fileId": str(row["file_id"]) if row["file_id"] else None,
                "mimeType": row["mime_type"],
                "departmentId": str(row["department_id"]),
                "fileSize": 0,  # Not in schema, default to 0
                "active": row["active"],
                "createdAt": row["created_at"].isoformat(),
                "updatedAt": row["updated_at"].isoformat(),
            }
            for row in dept_docs_result
        ]

        # Get scenario-specific documents
        if scenario_ids:
            scenario_docs_result = await conn.fetch(
                """
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
                WHERE sd.scenario_id = ANY($1::uuid[]) AND d.active = true
            """,
                scenario_ids,
            )

            scenario_documents = [
                {
                    "id": str(row["id"]),
                    "name": row["name"],
                    "title": row["name"],  # Use name as title
                    "description": "",  # Documents don't have description in schema
                    "filePath": row["file_path"],
                    "type": row["type"],
                    "classified": row["classified"],
                    "fileId": str(row["file_id"]) if row["file_id"] else None,
                    "mimeType": row["mime_type"],
                    "departmentId": str(row["department_id"]),
                    "fileSize": 0,  # Not in schema, default to 0
                    "active": row["active"],
                    "createdAt": row["created_at"].isoformat(),
                    "updatedAt": row["updated_at"].isoformat(),
                }
                for row in scenario_docs_result
            ]

    # 10. Compute dynamic rubrics for each chat
    def compute_dynamic_rubric(
        chat_id: str, grade: dict[str, Any] | None, feedbacks: list[dict[str, Any]]
    ) -> dict[str, Any] | None:
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
                f
                for f in feedbacks
                if any(std["id"] == f["standardId"] for std in group_standards)
            ]

            if group_feedback_list:
                group_max_points = group["points"]
                max_standard_points = max(std["points"] for std in group_standards)
                avg_score = sum(f["total"] for f in group_feedback_list) / len(
                    group_feedback_list
                )
                normalized_score = round((avg_score / max_standard_points) * 5)

                skill_scores[group["name"]] = normalized_score
                skill_feedbacks[group["shortName"]] = "; ".join(
                    f["feedback"] or "" for f in group_feedback_list
                )
                total_possible_points += group_max_points

        return {
            "chatId": chat_id,
            "score": grade["score"],
            "passed": grade["passed"],
            "timeTaken": grade["timeTaken"],
            "skillScores": skill_scores,
            "skillFeedbacks": skill_feedbacks,
            "totalPossiblePoints": total_possible_points,
        }

    # 11. Build chat objects with all nested data
    chats = []
    for chat_row in chats_result:
        chat_id = str(chat_row["id"])
        scenario_id = str(chat_row["scenario_id"])

        grade = grades_by_chat.get(chat_id)
        feedbacks = feedbacks_by_grade.get(grade["id"], []) if grade else []
        dynamic_rubric = compute_dynamic_rubric(chat_id, grade, feedbacks)

        # Build hints array
        chat_messages = messages_by_chat.get(chat_id, [])
        hints_array = []
        for msg in chat_messages:
            if msg["type"] == "response" and msg["id"] in hints_by_message:
                hints_array.append(
                    {
                        "messageId": msg["id"],
                        "hints": hints_by_message[msg["id"]],
                    }
                )

        # Compute grading state for TableRubric (which standards achieved/passed)
        grading_state = None
        if grade and feedbacks and standard_groups:
            achieved_standards = {}
            passed_standards = {}

            for group_id, group in standard_groups.items():
                group_standards = standards_by_group.get(group_id, [])
                if not group_standards:
                    continue

                # Get feedbacks for this group
                group_feedbacks = [
                    f
                    for f in feedbacks
                    if any(std["id"] == f["standardId"] for std in group_standards)
                ]

                if group_feedbacks:
                    # Find highest score in group
                    max_score = max(f["total"] for f in group_feedbacks)
                    # Get pass points from the group mapping
                    group_mapping = rubric_structure_groups_mapping.get(group_id, {})
                    pass_points = (
                        group_mapping.get("passPoints", 0) if group_mapping else 0
                    )

                    for feedback in group_feedbacks:
                        standard_id = feedback["standardId"]
                        # Standard is achieved if it has the max score in its group
                        achieved_standards[standard_id] = feedback["total"] == max_score
                        # Standard is passed if it meets pass points
                        passed_standards[standard_id] = feedback["total"] >= pass_points

            grading_state = {
                "achievedStandards": achieved_standards,
                "passedStandards": passed_standards,
                "gradeDescription": grade.get("description", ""),
            }

        chats.append(
            {
                "chat": {
                    "id": chat_id,
                    "createdAt": chat_row["created_at"].isoformat(),
                    "updatedAt": chat_row["updated_at"].isoformat(),
                    "title": chat_row["title"],
                    "scenarioId": scenario_id,
                    "attemptId": str(chat_row["attempt_id"]),
                    "completed": chat_row["completed"],
                    "traceId": str(chat_row["trace_id"])
                    if chat_row["trace_id"]
                    else None,
                },
                "scenario": scenarios.get(scenario_id),
                "messages": chat_messages,
                "hints": hints_array,
                "grade": grade,
                "feedbacks": feedbacks,
                "dynamicRubric": dynamic_rubric,
                "gradingState": grading_state,
            }
        )

    # 12. Compute aggregated results
    completed_rubrics = [
        c["dynamicRubric"]
        for c in chats
        if isinstance(c.get("chat"), dict)
        and c["chat"].get("completed")  # type: ignore
        and c.get("dynamicRubric")
    ]
    aggregated_results = None
    if completed_rubrics:
        total_score = sum(
            r["score"] for r in completed_rubrics if isinstance(r, dict)
        )  # type: ignore
        average_score = total_score / len(completed_rubrics)
        passed_chats = sum(
            1 for r in completed_rubrics if isinstance(r, dict) and r.get("passed")
        )
        total_time = sum(
            r["timeTaken"] for r in completed_rubrics if isinstance(r, dict)
        )  # type: ignore

        aggregated_results = {
            "totalChats": len(completed_rubrics),
            "passedChats": passed_chats,
            "averageScore": round(average_score * 10) / 10,
            "totalTime": total_time,
            "overallPassed": passed_chats == len(completed_rubrics),
        }

    # 13. Compute timer state
    current_time = datetime.now(UTC)
    attempt_start_time = attempt_result["created_at"]

    # Calculate total elapsed time
    total_elapsed_seconds = 0
    for chat in chats:
        chat_data = chat.get("chat")
        if not isinstance(chat_data, dict):
            continue
        created_at_str = chat_data.get("createdAt")
        if not isinstance(created_at_str, str):
            continue
        chat_start = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        if chat_data.get("completed") and chat_data.get("completedAt"):
            completed_at_str = chat_data.get("completedAt")
            if isinstance(completed_at_str, str):
                chat_end = datetime.fromisoformat(
                    completed_at_str.replace("Z", "+00:00")
                )
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
        if not chat["chat"]["completed"]:  # type: ignore
            current_chat_index = i
            break

    expected_chat_count = len(chats)
    is_single_chat_attempt = expected_chat_count == 1
    is_last_attempt = current_chat_index == expected_chat_count - 1
    show_results = all(c["chat"]["completed"] for c in chats) if chats else False  # type: ignore
    is_active = not (expired or show_results)

    # Build rubric structure for TableRubric component
    rubric_structure = None
    if rubric_structure_groups:
        rubric_structure = {
            "standardGroups": rubric_structure_groups,
            "standardGroupsMapping": rubric_structure_groups_mapping,
            "standardsMapping": rubric_structure_standards_mapping,
        }

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
        "rubricStructure": rubric_structure,
    }
