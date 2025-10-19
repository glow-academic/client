"""Scenario queries - SQL query builders."""

from typing import Any


class ScenarioQueries:
    """Query builders for scenario operations."""

    def list_scenarios(
        self, department_ids: list[str], profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for scenarios list with all relationships and embedded mappings."""
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
        ),
        scenario_data AS (
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
        ),
        objective_mapping_data AS (
            SELECT '{}'::jsonb as mapping
        ),
        all_parameter_item_ids AS (
            SELECT DISTINCT unnest(parameter_item_ids) as parameter_item_id
            FROM scenario_data
        ),
        parameter_item_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name,
                        'description', COALESCE(pi.description, ''),
                        'parameter_id', pi.parameter_id::text,
                        'parameter_name', p.name
                    )
                ) FILTER (WHERE pi.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE pi.id IN (SELECT parameter_item_id FROM all_parameter_item_ids)
        ),
        all_cohort_ids AS (
            SELECT DISTINCT unnest(cohort_ids) as cohort_id
            FROM scenario_data
            WHERE cohort_ids IS NOT NULL
        ),
        cohort_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    c.id::text,
                    jsonb_build_object(
                        'name', c.title,
                        'description', COALESCE(c.description, '')
                    )
                ) FILTER (WHERE c.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM cohorts c
            WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
        ),
        all_persona_ids AS (
            SELECT DISTINCT persona_id
            FROM scenario_data
            WHERE persona_id IS NOT NULL
        ),
        persona_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', COALESCE(p.description, ''),
                        'color', p.color,
                        'icon', p.icon
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM personas p
            WHERE p.id IN (SELECT persona_id FROM all_persona_ids)
        )
        SELECT 
            sd.*,
            om.mapping as objective_mapping,
            pim.mapping as parameter_item_mapping,
            cm.mapping as cohort_mapping,
            pm.mapping as persona_mapping
        FROM scenario_data sd
        CROSS JOIN objective_mapping_data om
        CROSS JOIN parameter_item_mapping_data pim
        CROSS JOIN cohort_mapping_data cm
        CROSS JOIN persona_mapping_data pm
        ORDER BY sd.title
        """

        return (query, [department_ids, profile_id])

    def get_parameter_item_mapping(
        self, parameter_item_ids: list[str]
    ) -> tuple[str, list[Any]]:
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

    def get_persona_mapping(self, persona_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for persona mapping."""
        query = "SELECT id, name, COALESCE(description, '') as description, color, icon FROM personas WHERE id = ANY($1)"
        return (query, [persona_ids])

    def get_scenario_by_id(self, scenario_id: str) -> tuple[str, list[Any]]:
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

    def get_scenario_detail_complete(
        self, scenario_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get complete scenario detail with all relationships and mappings in single query.

        Consolidates 16 separate queries into 1 mega-query with JSONB aggregations.

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH 
        user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        ),
        user_departments AS (
            SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
            FROM profile_departments pd
            WHERE pd.profile_id = $2
        ),
        scenario_core AS (
            SELECT 
                s.id,
                s.name,
                s.problem_statement,
                s.active,
                s.default_scenario,
                s.generated,
                s.department_id,
                st.parent_id::text as parent_scenario_id
            FROM scenarios s
            LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
            WHERE s.id = $1
        ),
        scenario_persona AS (
            SELECT persona_id::text
            FROM scenario_personas
            WHERE scenario_id = $1 AND active = true
            LIMIT 1
        ),
        scenario_documents_agg AS (
            SELECT ARRAY_AGG(document_id::text ORDER BY document_id) as document_ids
            FROM scenario_documents
            WHERE scenario_id = $1 AND active = true
        ),
        scenario_objectives_data AS (
            SELECT 
                COALESCE(ARRAY_AGG(scenario_id::text || '_' || idx::text ORDER BY idx), ARRAY[]::text[]) as objective_ids,
                COALESCE(jsonb_object_agg(
                    scenario_id::text || '_' || idx::text,
                    jsonb_build_object('name', objective, 'description', objective)
                ) FILTER (WHERE objective IS NOT NULL), '{}'::jsonb) as objective_mapping
            FROM scenario_objectives
            WHERE scenario_id = $1
        ),
        scenario_simulations_agg AS (
            SELECT 
                COALESCE(ARRAY_AGG(DISTINCT simulation_id::text), ARRAY[]::text[]) as simulation_ids,
                COUNT(DISTINCT CASE WHEN s.active THEN simulation_id END) as active_usage_count
            FROM simulation_scenarios ss
            JOIN simulations s ON s.id = ss.simulation_id
            WHERE ss.scenario_id = $1 AND ss.active = true
        ),
        scenario_parameters_data AS (
            SELECT 
                COALESCE(jsonb_object_agg(
                    pi.parameter_id::text,
                    jsonb_build_object(
                        'parameter_item_ids', COALESCE((
                            SELECT jsonb_agg(spi2.parameter_item_id::text ORDER BY spi2.parameter_item_id)
                            FROM scenario_parameter_items spi2
                            JOIN parameter_items pi2 ON pi2.id = spi2.parameter_item_id
                            WHERE spi2.scenario_id = $1 AND pi2.parameter_id = pi.parameter_id AND spi2.active = true
                        ), '[]'::jsonb),
                        'valid_parameter_item_ids', COALESCE((
                            SELECT jsonb_agg(id::text ORDER BY id)
                            FROM parameter_items
                            WHERE parameter_id = pi.parameter_id
                        ), '[]'::jsonb)
                    )
                ), '{}'::jsonb) as parameters_json
            FROM (
                SELECT DISTINCT pi.parameter_id 
                FROM scenario_parameter_items spi
                JOIN parameter_items pi ON pi.id = spi.parameter_item_id
                WHERE spi.scenario_id = $1 AND spi.active = true
            ) pi
        ),
        all_parameter_item_ids AS (
            SELECT DISTINCT unnest(ARRAY(
                SELECT jsonb_array_elements_text(
                    value->'parameter_item_ids'
                )::uuid
                FROM scenario_parameters_data, jsonb_each(parameters_json)
                WHERE jsonb_typeof(value->'parameter_item_ids') = 'array'
            )) as param_item_id
        ),
        valid_personas_data AS (
            SELECT 
                COALESCE(ARRAY_AGG(p.id::text ORDER BY p.name), ARRAY[]::text[]) as valid_persona_ids,
                COALESCE(jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', COALESCE(p.description, ''),
                        'color', p.color,
                        'icon', p.icon
                    )
                ), '{}'::jsonb) as persona_mapping
            FROM (
                SELECT DISTINCT ON (p.id) p.*
                FROM personas p, user_departments ud
                WHERE p.department_id = ANY(ud.dept_ids)
            ) p
        ),
        valid_documents_data AS (
            SELECT 
                COALESCE(ARRAY_AGG(d.id::text ORDER BY d.name), ARRAY[]::text[]) as valid_document_ids,
                COALESCE(jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object('name', d.name, 'description', COALESCE(d.type::text, ''))
                ), '{}'::jsonb) as document_mapping
            FROM (
                SELECT DISTINCT ON (d.id) d.*
                FROM documents d, user_departments ud
                WHERE d.department_id = ANY(ud.dept_ids)
            ) d
        ),
        simulation_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                s.id::text,
                jsonb_build_object('name', s.title, 'description', COALESCE(s.description, ''))
            ), '{}'::jsonb) as simulation_mapping
            FROM simulations s
            WHERE s.id = ANY(
                COALESCE((SELECT simulation_ids::uuid[] FROM scenario_simulations_agg), ARRAY[]::uuid[])
            )
        ),
        parameter_mapping_data AS (
            SELECT 
                COALESCE(jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object('name', p.name, 'description', COALESCE(p.description, ''))
                ), '{}'::jsonb) as parameter_mapping,
                COALESCE(jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name,
                        'description', COALESCE(pi.description, ''),
                        'parameter_id', pi.parameter_id::text,
                        'parameter_name', p.name
                    )
                ), '{}'::jsonb) as parameter_item_mapping
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE pi.id IN (SELECT param_item_id FROM all_parameter_item_ids)
        ),
        department_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                d.id::text,
                jsonb_build_object('name', d.title, 'description', COALESCE(d.description, ''))
            ), '{}'::jsonb) as department_mapping
            FROM departments d, user_departments ud
            WHERE d.id = ANY(ud.dept_ids)
        )
        SELECT 
            sc.id,
            sc.name,
            sc.problem_statement,
            sc.active,
            sc.default_scenario,
            sc.generated,
            sc.department_id::text,
            sc.parent_scenario_id,
            sp.persona_id,
            COALESCE(sd.document_ids, ARRAY[]::text[]) as document_ids,
            COALESCE(sod.objective_ids, ARRAY[]::text[]) as objective_ids,
            COALESCE(ssa.simulation_ids, ARRAY[]::text[]) as simulation_ids,
            COALESCE(spd.parameters_json, '{}'::jsonb) as parameters_json,
            COALESCE(vpd.valid_persona_ids, ARRAY[]::text[]) as valid_persona_ids,
            COALESCE(vdd.valid_document_ids, ARRAY[]::text[]) as valid_document_ids,
            (SELECT dept_ids FROM user_departments) as valid_department_ids,
            COALESCE(ssa.active_usage_count, 0) as active_usage_count,
            up.role as user_role,
            sod.objective_mapping,
            vpd.persona_mapping,
            vdd.document_mapping,
            smd.simulation_mapping,
            pmd.parameter_mapping,
            pmd.parameter_item_mapping,
            dmd.department_mapping
        FROM scenario_core sc
        CROSS JOIN user_profile up
        LEFT JOIN scenario_persona sp ON true
        LEFT JOIN scenario_documents_agg sd ON true
        LEFT JOIN scenario_objectives_data sod ON true
        LEFT JOIN scenario_simulations_agg ssa ON true
        LEFT JOIN scenario_parameters_data spd ON true
        CROSS JOIN valid_personas_data vpd
        CROSS JOIN valid_documents_data vdd
        CROSS JOIN simulation_mapping_data smd
        CROSS JOIN parameter_mapping_data pmd
        CROSS JOIN department_mapping_data dmd
        """
        return (query, [scenario_id, profile_id])

    def get_scenario_persona(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's persona."""
        query = """
        SELECT persona_id FROM scenario_personas 
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_scenario_documents(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's documents."""
        query = """
        SELECT document_id FROM scenario_documents 
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_scenario_objectives(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's objectives."""
        query = """
        SELECT (scenario_id::text || '_' || idx::text) as objective_id, objective
        FROM scenario_objectives
        WHERE scenario_id = $1
        ORDER BY idx
        """
        return (query, [scenario_id])

    def get_scenario_parameters(self, scenario_id: str) -> tuple[str, list[Any]]:
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
        self, parameter_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query for valid parameter items."""
        query = """
        SELECT 
            pi.parameter_id,
            pi.id as parameter_item_id
        FROM parameter_items pi
        WHERE pi.parameter_id = ANY($1) AND pi.active = true
        """
        return (query, [parameter_ids])

    def get_scenario_simulations(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's simulations."""
        query = """
        SELECT simulation_id FROM simulation_scenarios 
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_valid_personas(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid personas."""
        query = """
        SELECT id, name FROM personas 
        WHERE department_id = ANY($1) AND active = true
        ORDER BY name
        """
        return (query, [dept_ids])

    def get_valid_documents(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid documents."""
        query = """
        SELECT id, name FROM documents 
        WHERE department_id = ANY($1) AND active = true
        ORDER BY name
        """
        return (query, [dept_ids])

    def get_simulation_mapping(self, sim_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for simulation mapping."""
        query = "SELECT id, title FROM simulations WHERE id = ANY($1)"
        return (query, [sim_ids])

    def get_document_mapping(self, doc_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for document mapping."""
        query = "SELECT id, name FROM documents WHERE id = ANY($1)"
        return (query, [doc_ids])

    def get_parameter_mapping(self, param_item_ids: list[str]) -> tuple[str, list[Any]]:
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

    def get_default_scenario(self, profile_id: str) -> tuple[str, list[Any]]:
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

    def get_scenario_name(self, scenario_id: str) -> tuple[str, list[Any]]:
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

    def delete_scenario_personas(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to delete scenario personas."""
        query = "DELETE FROM scenario_personas WHERE scenario_id = $1"
        return (query, [scenario_id])

    def delete_scenario_documents(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to delete scenario documents."""
        query = "DELETE FROM scenario_documents WHERE scenario_id = $1"
        return (query, [scenario_id])

    def delete_scenario_objectives(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to delete scenario objectives."""
        query = "DELETE FROM scenario_objectives WHERE scenario_id = $1"
        return (query, [scenario_id])

    def delete_scenario_parameters(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to delete scenario parameters."""
        query = """
        DELETE FROM scenario_parameter_items WHERE scenario_id = $1
        """
        return (query, [scenario_id])

    def get_scenario_for_duplicate(self, scenario_id: str) -> tuple[str, list[Any]]:
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

    def check_scenario_usage(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to check scenario usage."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulation_scenarios
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def delete_scenario(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to delete scenario."""
        query = "DELETE FROM scenarios WHERE id = $1"
        return (query, [scenario_id])

    def get_enhanced_scenario_mapping(
        self, scenario_ids: list[str]
    ) -> tuple[str, list[Any]]:
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

    # Queries for randomly_fill_scenario_attributes
    def get_scenario_persona_link(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's active persona link."""
        query = """
        SELECT persona_id
        FROM scenario_personas
        WHERE scenario_id = $1 AND active = true
        LIMIT 1
        """
        return (query, [scenario_id])

    def get_active_personas(self) -> tuple[str, list[Any]]:
        """Build query to get all active personas."""
        query = "SELECT id FROM personas WHERE active = true"
        return (query, [])

    def get_scenario_document_links(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's document links."""
        query = """
        SELECT document_id FROM scenario_documents 
        WHERE scenario_id = $1
        """
        return (query, [scenario_id])

    def get_scenario_parameter_links(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's parameter item links."""
        query = """
        SELECT parameter_item_id FROM scenario_parameter_items 
        WHERE scenario_id = $1
        """
        return (query, [scenario_id])

    def get_active_documents(self) -> tuple[str, list[Any]]:
        """Build query to get all active documents with details."""
        query = "SELECT id, name, type, file_path FROM documents WHERE active = true"
        return (query, [])

    def get_active_parameters(self) -> tuple[str, list[Any]]:
        """Build query to get all active parameters."""
        query = "SELECT id, name FROM parameters WHERE active = true"
        return (query, [])

    def get_parameter_items_by_parameter(
        self, parameter_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items for a parameter."""
        query = "SELECT id, name FROM parameter_items WHERE parameter_id = $1"
        return (query, [parameter_id])

    def get_parameter_items_batch(
        self, parameter_item_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items with their parameter_id."""
        query = """
        SELECT id, parameter_id FROM parameter_items 
        WHERE id = ANY($1::uuid[])
        """
        return (query, [parameter_item_ids])

    def insert_scenario_variant(self) -> str:
        """Build query to insert a scenario variant.

        Params order: name, problem_statement, department_id, generated, active, default_scenario
        """
        return """
        INSERT INTO scenarios (name, problem_statement, department_id, generated, active, default_scenario)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """

    def insert_scenario_tree_edge(self) -> str:
        """Build query to insert scenario tree edge.

        Params order: parent_scenario_id, child_scenario_id, active
        """
        return """
        INSERT INTO scenario_tree (parent_scenario_id, child_scenario_id, active)
        VALUES ($1, $2, $3)
        """

    def insert_scenario_persona_link(self) -> str:
        """Build query to insert scenario-persona link.

        Params order: scenario_id, persona_id, active
        """
        return """
        INSERT INTO scenario_personas (scenario_id, persona_id, active)
        VALUES ($1, $2, $3)
        """

    def insert_scenario_document_link(self) -> str:
        """Build query to insert scenario-document link.

        Params order: scenario_id, document_id, active
        """
        return """
        INSERT INTO scenario_documents (scenario_id, document_id, active)
        VALUES ($1, $2, $3)
        """

    def insert_scenario_parameter_link(self) -> str:
        """Build query to insert scenario-parameter_item link.

        Params order: scenario_id, parameter_item_id, active
        """
        return """
        INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id, active)
        VALUES ($1, $2, $3)
        """

    # Queries for suggest_randomized_sections
    def get_persona_by_id(self, persona_id: str) -> tuple[str, list[Any]]:
        """Build query to get persona by ID."""
        query = "SELECT id, name, description FROM personas WHERE id = $1"
        return (query, [persona_id])

    def get_documents_by_ids(self, document_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to get documents by IDs."""
        query = (
            "SELECT id, name, type, file_path FROM documents WHERE id = ANY($1::uuid[])"
        )
        return (query, [document_ids])

    def get_parameter_items_with_details(
        self, parameter_item_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items with full details."""
        query = """
        SELECT id, name, description, value, parameter_id 
        FROM parameter_items 
        WHERE id = ANY($1::uuid[])
        """
        return (query, [parameter_item_ids])

    def get_parameters_with_items(
        self, parameter_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameters with their items."""
        query = """
        SELECT 
            p.id as parameter_id,
            p.name as parameter_name,
            p.description as parameter_description,
            p.default_parameter,
            pi.id as item_id,
            pi.name as item_name,
            pi.description as item_description,
            pi.value as item_value
        FROM parameters p
        LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
        WHERE p.id = ANY($1::uuid[])
        ORDER BY p.id, pi.name
        """
        return (query, [parameter_ids])

    def search_scenarios_fuzzy(
        self, where_clause: str, limit: int
    ) -> tuple[str, list[Any]]:
        """
        Build fuzzy search query for scenarios by name and problem_statement.
        Uses dynamic WHERE clause built by search utilities.
        Includes persona_id in main query to avoid N+1.

        Params: Built dynamically by search utilities, plus limit at end
        """
        query = f"""
            SELECT 
                s.id,
                s.name,
                s.problem_statement,
                s.default_scenario,
                sp.persona_id
            FROM scenarios s
            LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true
            WHERE {where_clause}
            LIMIT ${{param_count}}
        """
        return (query, [limit])

    def get_scenario_overview_complete(self, scenario_id: Any) -> tuple[str, list[Any]]:
        """Build optimized query to get scenario overview with all related data in ONE query.

        Fetches scenario + simulations + persona using LEFT JOINs and JSON aggregation
        to avoid N+1 queries.

        Args:
            scenario_id: UUID of the scenario

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        SELECT 
            s.id, s.name, s.problem_statement, s.default_scenario, 
            s.created_at, s.updated_at,
            -- Simulations array (json_agg with filtering)
            COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object(
                    'id', sim.id,
                    'title', sim.title,
                    'active', sim.active,
                    'time_limit', sim.time_limit,
                    'created_at', sim.created_at
                )) FILTER (WHERE sim.id IS NOT NULL),
                '[]'::jsonb
            ) as simulations,
            -- Persona ID (single value from junction)
            (SELECT persona_id FROM scenario_personas 
             WHERE scenario_id = s.id AND active = true LIMIT 1) as persona_id
        FROM scenarios s
        LEFT JOIN simulation_scenarios ss ON ss.scenario_id = s.id
        LEFT JOIN simulations sim ON sim.id = ss.simulation_id
        WHERE s.id = $1
        GROUP BY s.id, s.name, s.problem_statement, s.default_scenario, 
                 s.created_at, s.updated_at
        """
        return (query, [scenario_id])

    def get_valid_parameter_items_for_parameters(
        self, parameter_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get valid parameter items for given parameters."""
        query = """
        SELECT 
            pi.parameter_id,
            pi.id as parameter_item_id
        FROM parameter_items pi
        WHERE pi.parameter_id = ANY($1::uuid[]) AND pi.active = true
        """
        return (query, [parameter_ids])

    def get_departments_for_profile(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get departments for a profile."""
        query = """
        SELECT DISTINCT d.id
        FROM departments d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = $1 AND d.active = true
        """
        return (query, [profile_id])

    def get_valid_personas_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get valid personas for departments."""
        query = """
        SELECT id, name, COALESCE(description, '') as description, color, icon 
        FROM personas 
        WHERE department_id = ANY($1::uuid[]) AND active = true
        ORDER BY name
        """
        return (query, [department_ids])

    def get_valid_documents_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get valid documents for departments."""
        query = """
        SELECT id, name, type::text as description 
        FROM documents 
        WHERE department_id = ANY($1::uuid[]) AND active = true
        ORDER BY name
        """
        return (query, [department_ids])

    def get_simulations_by_ids(
        self, simulation_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get simulations by IDs."""
        query = """
        SELECT id, title, COALESCE(description, '') as description 
        FROM simulations 
        WHERE id = ANY($1::uuid[])
        """
        return (query, [simulation_ids])

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile role."""
        query = "SELECT role FROM profiles WHERE id = $1"
        return (query, [profile_id])

    def get_departments_by_ids(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get departments by IDs."""
        query = """
        SELECT id, title, COALESCE(description, '') as description 
        FROM departments 
        WHERE id = ANY($1::uuid[])
        """
        return (query, [department_ids])

    # ===== Additional queries for scenario detail and list building =====

    def get_scenario_documents_aggregated(
        self, scenario_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get aggregated document IDs per scenario."""
        query = """
        SELECT scenario_id, ARRAY_AGG(document_id) as document_ids
        FROM scenario_documents
        WHERE scenario_id = ANY($1::uuid[]) AND active = true
        GROUP BY scenario_id
        """
        return (query, [scenario_ids])

    def get_documents_mapping(self, document_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to get documents mapping with type as description."""
        query = """
        SELECT id, name, type::text as description
        FROM documents
        WHERE id = ANY($1::uuid[])
        """
        return (query, [document_ids])

    def get_scenario_basic_with_tree(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario with tree parent relationship."""
        query = """
        SELECT 
            s.name,
            s.problem_statement,
            s.active,
            s.default_scenario,
            s.department_id,
            COALESCE(s.generated, false) as generated,
            st.parent_scenario_id
        FROM scenarios s
        LEFT JOIN scenario_tree st ON st.child_scenario_id = s.id
        WHERE s.id = $1
        """
        return (query, [scenario_id])

    def get_parameters_from_items(
        self, parameter_item_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get parameters from parameter items."""
        query = """
        SELECT DISTINCT
            p.id as parameter_id,
            p.name,
            p.description
        FROM parameters p
        JOIN parameter_items pi ON pi.parameter_id = p.id
        WHERE pi.id = ANY($1::uuid[])
        """
        return (query, [parameter_item_ids])

    def get_parameter_items_full(
        self, parameter_item_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get full parameter items with parameter name."""
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
        WHERE pi.id = ANY($1::uuid[])
        """
        return (query, [parameter_item_ids])

    def check_scenario_active_usage(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to check if scenario is used by active simulations."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM simulation_scenarios ss
        JOIN simulations s ON s.id = ss.simulation_id
        WHERE ss.scenario_id = $1 
        AND ss.active = true 
        AND s.active = true
        """
        return (query, [scenario_id])

    def get_active_parameters_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get active parameters for departments."""
        query = """
        SELECT DISTINCT p.id, p.name, p.description
        FROM parameters p
        WHERE p.department_id = ANY($1::uuid[]) AND p.active = true
        ORDER BY p.name
        """
        return (query, [department_ids])

    def get_active_parameter_items_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get active parameter items with parameter name."""
        query = """
        SELECT pi.id, pi.name, pi.description, pi.parameter_id, p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE p.department_id = ANY($1::uuid[]) AND pi.active = true
        ORDER BY p.name, pi.name
        """
        return (query, [department_ids])

    def get_scenario_detail_default_complete(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build consolidated query for scenario detail default with all data in ONE query."""
        query = """
        WITH user_departments AS (
            SELECT DISTINCT d.id
            FROM departments d
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = $1 AND d.active = true
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
            ) as mapping
            FROM departments d
            WHERE d.id IN (SELECT id FROM user_departments)
        ),
        persona_data AS (
            SELECT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.color,
                p.icon
            FROM personas p
            WHERE p.department_id IN (SELECT id FROM user_departments) 
            AND p.active = true
            ORDER BY p.name
        ),
        persona_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', p.description,
                        'color', p.color,
                        'icon', p.icon
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM persona_data p
        ),
        document_data AS (
            SELECT 
                d.id,
                d.name,
                d.type::text as description
            FROM documents d
            WHERE d.department_id IN (SELECT id FROM user_departments)
            AND d.active = true
            ORDER BY d.name
        ),
        document_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.name,
                        'description', d.description
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM document_data d
        ),
        parameter_data AS (
            SELECT DISTINCT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description
            FROM parameters p
            WHERE p.department_id IN (SELECT id FROM user_departments)
            AND p.active = true
            ORDER BY p.name
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', p.description
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM parameter_data p
        ),
        parameter_item_data AS (
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description,
                pi.parameter_id,
                p.name as parameter_name
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id IN (SELECT id FROM user_departments)
            AND p.active = true
            ORDER BY p.name, pi.name
        ),
        parameter_item_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name,
                        'description', pi.description,
                        'parameter_id', pi.parameter_id::text,
                        'parameter_name', pi.parameter_name
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM parameter_item_data pi
        )
        SELECT 
            COALESCE(
                (SELECT array_agg(id::text ORDER BY id) FROM user_departments),
                ARRAY[]::text[]
            ) as department_ids,
            COALESCE(
                (SELECT array_agg(id::text) FROM persona_data),
                ARRAY[]::text[]
            ) as valid_persona_ids,
            COALESCE(
                (SELECT array_agg(id::text) FROM document_data),
                ARRAY[]::text[]
            ) as valid_document_ids,
            (SELECT mapping FROM department_mapping_data) as department_mapping,
            (SELECT mapping FROM persona_mapping_data) as persona_mapping,
            (SELECT mapping FROM document_mapping_data) as document_mapping,
            (SELECT mapping FROM parameter_mapping_data) as parameter_mapping,
            (SELECT mapping FROM parameter_item_mapping_data) as parameter_item_mapping
        """
        return (query, [profile_id])
