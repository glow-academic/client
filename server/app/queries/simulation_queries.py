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

