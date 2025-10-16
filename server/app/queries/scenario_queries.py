"""Scenario queries - SQL query builders."""

from typing import Any, List, Tuple


class ScenarioQueries:
    """Query builders for scenario operations."""

    def list_scenarios(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, List[Any]]:
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
            SELECT role FROM profiles WHERE id = $2
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
        WHERE s.department_id = ANY($1)
        ORDER BY s.name
        """

        return (query, [department_ids, profile_id])

    def get_objective_mapping(
        self, scenario_ids: List[str], idxs: List[int]
    ) -> Tuple[str, List[Any]]:
        """Build query for objective mapping."""
        query = """
        SELECT 
            scenario_id,
            idx,
            objective,
            (scenario_id::text || '_' || idx::text) as objective_id
        FROM scenario_objectives
        WHERE (scenario_id, idx) IN (
            SELECT unnest($1::uuid[]), unnest($2::integer[])
        )
        """
        return (query, [scenario_ids, idxs])

    def get_parameter_item_mapping(
        self, parameter_item_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for parameter item mapping."""
        query = """
        SELECT 
            pi.id,
            pi.name,
            pi.description,
            pi.value,
            pi.parameter_id,
            p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE pi.id = ANY($1)
        """
        return (query, [parameter_item_ids])

    def get_cohort_mapping(
        self, cohort_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for cohort mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description FROM cohorts WHERE id = ANY($1)"
        return (query, [cohort_ids])

    def get_persona_mapping(
        self, persona_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for persona mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description, color, icon FROM personas WHERE id = ANY($1)"
        return (query, [persona_ids])

    def get_scenario_by_id(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario by ID."""
        query = """
        SELECT 
            s.name,
            s.problem_statement,
            s.active,
            s.default_scenario,
            s.department_id
        FROM scenarios s
        WHERE s.id = $1
        """
        return (query, [scenario_id])

    def get_scenario_persona(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario's persona."""
        query = """
        SELECT persona_id FROM scenario_personas 
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_scenario_documents(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario's documents."""
        query = """
        SELECT document_id FROM scenario_documents 
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_scenario_objectives(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario's objectives."""
        query = """
        SELECT (scenario_id::text || '_' || idx::text) as objective_id, objective
        FROM scenario_objectives
        WHERE scenario_id = $1
        ORDER BY idx
        """
        return (query, [scenario_id])

    def get_scenario_parameters(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario's parameters."""
        query = """
        SELECT 
            pi.parameter_id,
            spi.parameter_item_id
        FROM scenario_parameter_items spi
        JOIN parameter_items pi ON pi.id = spi.parameter_item_id
        WHERE spi.scenario_id = $1 AND spi.active = true
        """
        return (query, [scenario_id])

    def get_valid_parameter_items(
        self, parameter_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for valid parameter items."""
        query = """
        SELECT 
            pi.parameter_id,
            pi.id as parameter_item_id
        FROM parameter_items pi
        WHERE pi.parameter_id = ANY($1) AND pi.active = true
        """
        return (query, [parameter_ids])

    def get_scenario_simulations(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario's simulations."""
        query = """
        SELECT simulation_id FROM simulation_scenarios 
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_valid_personas(
        self, dept_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for valid personas."""
        query = """
        SELECT id, name FROM personas 
        WHERE department_id = ANY($1) AND active = true
        ORDER BY name
        """
        return (query, [dept_ids])

    def get_valid_documents(
        self, dept_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for valid documents."""
        query = """
        SELECT id, name FROM documents 
        WHERE department_id = ANY($1) AND active = true
        ORDER BY name
        """
        return (query, [dept_ids])

    def get_simulation_mapping(
        self, sim_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for simulation mapping."""
        query = "SELECT id, title FROM simulations WHERE id = ANY($1)"
        return (query, [sim_ids])

    def get_document_mapping(
        self, doc_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for document mapping."""
        query = "SELECT id, name FROM documents WHERE id = ANY($1)"
        return (query, [doc_ids])

    def get_parameter_mapping(
        self, param_item_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for parameter mapping."""
        query = """
        SELECT DISTINCT
            p.id as parameter_id,
            p.name,
            p.description
        FROM parameters p
        JOIN parameter_items pi ON pi.parameter_id = p.id
        WHERE pi.id = ANY($1)
        """
        return (query, [param_item_ids])

    def get_default_scenario(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for default scenario."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT pd.department_id
            FROM profile_departments pd
            WHERE pd.profile_id = $1
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
        return (query, [profile_id])

    def create_scenario(self) -> str:
        """Build query to create scenario.
        
        Params order: name, problem_statement, department_id, active, default_scenario
        """
        return """
        INSERT INTO scenarios (
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """

    def insert_scenario_persona(self) -> str:
        """Build query to insert scenario persona.
        
        Params order: scenario_id, persona_id
        """
        return """
        INSERT INTO scenario_personas (scenario_id, persona_id, active)
        VALUES ($1, $2, true)
        """

    def insert_scenario_document(self) -> str:
        """Build query to insert scenario document.
        
        Params order: scenario_id, document_id
        """
        return """
        INSERT INTO scenario_documents (scenario_id, document_id, active)
        VALUES ($1, $2, true)
        """

    def insert_scenario_objective(self) -> str:
        """Build query to insert scenario objective.
        
        Params order: scenario_id, idx, objective
        """
        return """
        INSERT INTO scenario_objectives (scenario_id, idx, objective)
        VALUES ($1, $2, $3)
        """

    def insert_scenario_parameter(self) -> str:
        """Build query to insert scenario parameter.
        
        Params order: scenario_id, parameter_item_id
        """
        return """
        INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
        VALUES ($1, $2, true)
        """

    def get_scenario_name(self, scenario_id: str) -> Tuple[str, List[Any]]:
        """Build query to get scenario name."""
        query = "SELECT name FROM scenarios WHERE id = $1"
        return (query, [scenario_id])

    def update_scenario(self) -> str:
        """Build query to update scenario.
        
        Params order: name, problem_statement, department_id, active, default_scenario, scenario_id
        """
        return """
        UPDATE scenarios SET
            name = $1,
            problem_statement = $2,
            department_id = $3,
            active = $4,
            default_scenario = $5,
            updated_at = NOW()
        WHERE id = $6
        """

    def delete_scenario_personas(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete scenario personas."""
        query = "DELETE FROM scenario_personas WHERE scenario_id = $1"
        return (query, [scenario_id])

    def delete_scenario_documents(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete scenario documents."""
        query = "DELETE FROM scenario_documents WHERE scenario_id = $1"
        return (query, [scenario_id])

    def delete_scenario_objectives(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete scenario objectives."""
        query = "DELETE FROM scenario_objectives WHERE scenario_id = $1"
        return (query, [scenario_id])

    def delete_scenario_parameters(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to delete scenario parameters."""
        query = """
        DELETE FROM scenario_parameter_items WHERE scenario_id = $1
        """
        return (query, [scenario_id])

    def get_scenario_for_duplicate(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to get scenario data for duplication."""
        query = """
        SELECT 
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        FROM scenarios
        WHERE id = $1
        """
        return (query, [scenario_id])

    def insert_duplicate_scenario(self) -> str:
        """Build query to insert duplicate scenario.
        
        Params order: name, problem_statement, department_id
        """
        return """
        INSERT INTO scenarios (
            name,
            problem_statement,
            department_id,
            active,
            default_scenario
        )
        VALUES (
            $1 || ' Copy',
            $2,
            $3,
            false,
            false
        )
        RETURNING id
        """

    def copy_scenario_personas(self) -> str:
        """Build query to copy scenario personas.
        
        Params order: new_scenario_id, original_scenario_id
        """
        return """
        INSERT INTO scenario_personas (scenario_id, persona_id, active)
        SELECT $1, persona_id, active
        FROM scenario_personas
        WHERE scenario_id = $2
        """

    def copy_scenario_documents(self) -> str:
        """Build query to copy scenario documents.
        
        Params order: new_scenario_id, original_scenario_id
        """
        return """
        INSERT INTO scenario_documents (scenario_id, document_id, active)
        SELECT $1, document_id, active
        FROM scenario_documents
        WHERE scenario_id = $2
        """

    def copy_scenario_objectives(self) -> str:
        """Build query to copy scenario objectives.
        
        Params order: new_scenario_id, original_scenario_id
        """
        return """
        INSERT INTO scenario_objectives (scenario_id, idx, objective)
        SELECT $1, idx, objective
        FROM scenario_objectives
        WHERE scenario_id = $2
        """

    def copy_scenario_parameters(self) -> str:
        """Build query to copy scenario parameters.
        
        Params order: new_scenario_id, original_scenario_id
        """
        return """
        INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
        SELECT $1, parameter_item_id, active
        FROM scenario_parameter_items
        WHERE scenario_id = $2
        """

    def check_scenario_usage(
        self, scenario_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to check scenario usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulation_scenarios
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def delete_scenario(self, scenario_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete scenario."""
        query = "DELETE FROM scenarios WHERE id = $1"
        return (query, [scenario_id])

    def get_enhanced_scenario_mapping(
        self, scenario_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for enhanced scenario mapping with nested data."""
        query = """
        SELECT 
            s.id as scenario_id,
            s.name,
            s.problem_statement as description,
            sp.persona_id,
            COALESCE(
                (SELECT ARRAY_AGG(DISTINCT spi.parameter_item_id)
                 FROM scenario_parameter_items spi
                 WHERE spi.scenario_id = s.id AND spi.active = true),
                ARRAY[]::uuid[]
            ) as parameter_item_ids
        FROM scenarios s
        LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
        WHERE s.id = ANY($1)
        """
        return (query, [scenario_ids])

