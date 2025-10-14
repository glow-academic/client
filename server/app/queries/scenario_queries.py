"""Scenario queries - SQL query builders."""

from typing import Any, Dict, List, Tuple


class ScenarioQueries:
    """Query builders for scenario operations."""

    def list_scenarios(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for scenarios list with all relationships."""
        query = """
        WITH scenario_objectives AS (
            SELECT 
                so.scenario_id,
                ARRAY_AGG((so.scenario_id::text || '_' || so.idx::text) ORDER BY so.idx) as objective_ids
            FROM scenario_objectives so
            GROUP BY so.scenario_id
        ),
        scenario_parameters AS (
            SELECT 
                spi.scenario_id,
                ARRAY_AGG(DISTINCT spi.parameter_item_id) as parameter_item_ids
            FROM scenario_parameter_items spi
            WHERE spi.active = true
            GROUP BY spi.scenario_id
        ),
        scenario_simulations AS (
            SELECT 
                ss.scenario_id,
                ARRAY_AGG(DISTINCT ss.simulation_id) as simulation_ids,
                COUNT(DISTINCT ss.simulation_id) as num_simulations
            FROM simulation_scenarios ss
            WHERE ss.active = true
            GROUP BY ss.scenario_id
        ),
        scenario_cohorts AS (
            SELECT DISTINCT
                ss.scenario_id,
                ARRAY_AGG(DISTINCT cs.cohort_id) as cohort_ids
            FROM simulation_scenarios ss
            JOIN cohort_simulations cs ON cs.simulation_id = ss.simulation_id
            WHERE ss.active = true AND cs.active = true
            GROUP BY ss.scenario_id
        ),
        scenario_personas AS (
            SELECT 
                sp.scenario_id,
                sp.persona_id
            FROM scenario_personas sp
            WHERE sp.active = true
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
        )
        SELECT 
            s.id as scenario_id,
            s.name as title,
            s.problem_statement,
            s.active,
            s.default_scenario,
            s.generated,
            st.parent_id::text as parent_scenario_id,
            COALESCE(so.objective_ids, ARRAY[]::text[]) as objective_ids,
            sp.persona_id,
            COALESCE(spar.parameter_item_ids, ARRAY[]::uuid[]) as parameter_item_ids,
            COALESCE(ss.simulation_ids, ARRAY[]::uuid[]) as simulation_ids,
            COALESCE(ss.num_simulations, 0) as num_simulations,
            COALESCE(sc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') AND COALESCE(ss.num_simulations, 0) = 0 THEN true
                ELSE false
            END as can_delete,
            true as can_duplicate
        FROM scenarios s
        LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
        LEFT JOIN scenario_objectives so ON so.scenario_id = s.id
        LEFT JOIN scenario_parameters spar ON spar.scenario_id = s.id
        LEFT JOIN scenario_simulations ss ON ss.scenario_id = s.id
        LEFT JOIN scenario_cohorts sc ON sc.scenario_id = s.id
        LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id
        CROSS JOIN user_profile up
        WHERE s.department_id = ANY(:department_ids)
        ORDER BY s.name
        """

        params = {"department_ids": department_ids, "profile_id": profile_id}
        return (query, params)

    def get_objective_mapping(
        self, scenario_ids: List[str], idxs: List[int]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for objective mapping."""
        query = """
        SELECT 
            scenario_id,
            idx,
            objective,
            (scenario_id::text || '_' || idx::text) as objective_id
        FROM scenario_objectives
        WHERE (scenario_id, idx) IN (
            SELECT unnest(:scenario_ids::uuid[]), unnest(:idxs::integer[])
        )
        """
        params = {"scenario_ids": scenario_ids, "idxs": idxs}
        return (query, params)

    def get_parameter_item_mapping(
        self, parameter_item_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for parameter item mapping."""
        query = """
        SELECT 
            pi.id,
            pi.name,
            pi.description,
            pi.value
        FROM parameter_items pi
        WHERE pi.id = ANY(:parameter_item_ids)
        """
        params = {"parameter_item_ids": parameter_item_ids}
        return (query, params)

    def get_cohort_mapping(
        self, cohort_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for cohort mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description FROM cohorts WHERE id = ANY(:cohort_ids)"
        params = {"cohort_ids": cohort_ids}
        return (query, params)

    def get_persona_mapping(
        self, persona_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for persona mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description, color, icon FROM personas WHERE id = ANY(:persona_ids)"
        params = {"persona_ids": persona_ids}
        return (query, params)

    def get_scenario_by_id(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario by ID."""
        query = """
        SELECT 
            s.name,
            s.problem_statement,
            s.active,
            s.default_scenario,
            s.department_id
        FROM scenarios s
        WHERE s.id = :scenario_id
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_scenario_persona(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario's persona."""
        query = """
        SELECT persona_id FROM scenario_personas 
        WHERE scenario_id = :scenario_id AND active = true
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_scenario_documents(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario's documents."""
        query = """
        SELECT document_id FROM scenario_documents 
        WHERE scenario_id = :scenario_id AND active = true
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_scenario_objectives(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario's objectives."""
        query = """
        SELECT (scenario_id::text || '_' || idx::text) as objective_id, objective
        FROM scenario_objectives
        WHERE scenario_id = :scenario_id
        ORDER BY idx
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_scenario_parameters(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario's parameters."""
        query = """
        SELECT 
            pi.parameter_id,
            spi.parameter_item_id
        FROM scenario_parameter_items spi
        JOIN parameter_items pi ON pi.id = spi.parameter_item_id
        WHERE spi.scenario_id = :scenario_id AND spi.active = true
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_valid_parameter_items(
        self, parameter_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid parameter items."""
        query = """
        SELECT 
            pi.parameter_id,
            pi.id as parameter_item_id
        FROM parameter_items pi
        WHERE pi.parameter_id = ANY(:parameter_ids) AND pi.active = true
        """
        params = {"parameter_ids": parameter_ids}
        return (query, params)

    def get_scenario_simulations(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario's simulations."""
        query = """
        SELECT simulation_id FROM simulation_scenarios 
        WHERE scenario_id = :scenario_id AND active = true
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_valid_personas(
        self, dept_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid personas."""
        query = """
        SELECT id, name FROM personas 
        WHERE department_id = ANY(:dept_ids) AND active = true
        ORDER BY name
        """
        params = {"dept_ids": dept_ids}
        return (query, params)

    def get_valid_documents(
        self, dept_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid documents."""
        query = """
        SELECT id, name FROM documents 
        WHERE department_id = ANY(:dept_ids) AND active = true
        ORDER BY name
        """
        params = {"dept_ids": dept_ids}
        return (query, params)

    def get_simulation_mapping(
        self, sim_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for simulation mapping."""
        query = "SELECT id, title FROM simulations WHERE id = ANY(:sim_ids)"
        params = {"sim_ids": sim_ids}
        return (query, params)

    def get_document_mapping(
        self, doc_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for document mapping."""
        query = "SELECT id, name FROM documents WHERE id = ANY(:doc_ids)"
        params = {"doc_ids": doc_ids}
        return (query, params)

    def get_parameter_mapping(
        self, param_item_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for parameter mapping."""
        query = """
        SELECT DISTINCT
            p.id as parameter_id,
            p.name,
            p.description
        FROM parameters p
        JOIN parameter_items pi ON pi.parameter_id = p.id
        WHERE pi.id = ANY(:param_item_ids)
        """
        params = {"param_item_ids": param_item_ids}
        return (query, params)

    def get_default_scenario(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for default scenario."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = :profile_id
        ),
        user_scenarios AS (
            SELECT s.*
            FROM scenarios s
            JOIN user_departments ud ON ud.department_id = s.department_id
            WHERE s.active = true
            ORDER BY s.default_scenario ASC, s.created_at DESC
            LIMIT 1
        )
        SELECT id
        FROM user_scenarios
        """
        params = {"profile_id": profile_id}
        return (query, params)

    def create_scenario(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to create scenario."""
        query = """
        INSERT INTO scenarios (
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        )
        VALUES (
            :name,
            :problem_statement,
            :department_id,
            :active,
            :default_scenario
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def insert_scenario_persona(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert scenario persona."""
        query = """
        INSERT INTO scenario_personas (scenario_id, persona_id, active)
        VALUES (:scenario_id, :persona_id, true)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def insert_scenario_document(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert scenario document."""
        query = """
        INSERT INTO scenario_documents (scenario_id, document_id, active)
        VALUES (:scenario_id, :document_id, true)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def insert_scenario_objective(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert scenario objective."""
        query = """
        INSERT INTO scenario_objectives (scenario_id, idx, objective)
        VALUES (:scenario_id, :idx, :objective)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def insert_scenario_parameter(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert scenario parameter."""
        query = """
        INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
        VALUES (:scenario_id, :parameter_item_id, true)
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_scenario_name(self, scenario_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario name."""
        query = "SELECT name FROM scenarios WHERE id = :scenario_id"
        params = {"scenario_id": scenario_id}
        return (query, params)

    def update_scenario(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update scenario."""
        query = """
        UPDATE scenarios SET
            name = :name,
            problem_statement = :problem_statement,
            department_id = :department_id,
            active = :active,
            default_scenario = :default_scenario,
            updated_at = NOW()
        WHERE id = :scenario_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def delete_scenario_personas(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete scenario personas."""
        query = "DELETE FROM scenario_personas WHERE scenario_id = :scenario_id"
        params = {"scenario_id": scenario_id}
        return (query, params)

    def delete_scenario_documents(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete scenario documents."""
        query = "DELETE FROM scenario_documents WHERE scenario_id = :scenario_id"
        params = {"scenario_id": scenario_id}
        return (query, params)

    def delete_scenario_objectives(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete scenario objectives."""
        query = "DELETE FROM scenario_objectives WHERE scenario_id = :scenario_id"
        params = {"scenario_id": scenario_id}
        return (query, params)

    def delete_scenario_parameters(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete scenario parameters."""
        query = """
        DELETE FROM scenario_parameter_items WHERE scenario_id = :scenario_id
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def get_scenario_for_duplicate(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get scenario data for duplication."""
        query = """
        SELECT 
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        FROM scenarios
        WHERE id = :scenario_id
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def insert_duplicate_scenario(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to insert duplicate scenario."""
        query = """
        INSERT INTO scenarios (
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        )
        VALUES (
            :name || ' Copy',
            :problem_statement,
            :department_id,
            false,
            false
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def copy_scenario_personas(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to copy scenario personas."""
        query = """
        INSERT INTO scenario_personas (scenario_id, persona_id, active)
        SELECT :new_scenario_id, persona_id, active
        FROM scenario_personas
        WHERE scenario_id = :original_scenario_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def copy_scenario_documents(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to copy scenario documents."""
        query = """
        INSERT INTO scenario_documents (scenario_id, document_id, active)
        SELECT :new_scenario_id, document_id, active
        FROM scenario_documents
        WHERE scenario_id = :original_scenario_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def copy_scenario_objectives(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to copy scenario objectives."""
        query = """
        INSERT INTO scenario_objectives (scenario_id, idx, objective)
        SELECT :new_scenario_id, idx, objective
        FROM scenario_objectives
        WHERE scenario_id = :original_scenario_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def copy_scenario_parameters(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to copy scenario parameters."""
        query = """
        INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
        SELECT :new_scenario_id, parameter_item_id, active
        FROM scenario_parameter_items
        WHERE scenario_id = :original_scenario_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def check_scenario_usage(
        self, scenario_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check scenario usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulation_scenarios
        WHERE scenario_id = :scenario_id AND active = true
        """
        params = {"scenario_id": scenario_id}
        return (query, params)

    def delete_scenario(self, scenario_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete scenario."""
        query = "DELETE FROM scenarios WHERE id = :scenario_id"
        params = {"scenario_id": scenario_id}
        return (query, params)

