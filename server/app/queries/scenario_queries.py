"""Scenario queries - SQL query builders."""

from typing import Any


class ScenarioQueries:
    """Query builders for scenario operations."""

    def list_scenarios(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for scenarios list with all relationships and embedded mappings."""
        query = """
        WITH user_departments AS (
            SELECT department_id
            FROM profile_departments
            WHERE profile_id = $1 AND active = true
        ),
        scenario_objectives AS (
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
        scenario_all_simulation_links AS (
            SELECT 
                ss.scenario_id,
                COUNT(*) as total_links
            FROM simulation_scenarios ss
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
        scenario_personas_agg AS (
            SELECT 
                sp.scenario_id,
                ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
            FROM scenario_personas sp
            WHERE sp.active = true
            GROUP BY sp.scenario_id
        ),
        user_profile AS (
            SELECT role FROM profiles WHERE id = $1
        ),
        scenario_departments_data AS (
            SELECT 
                sd.scenario_id,
                ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
            FROM scenario_departments sd
            WHERE sd.active = true
            GROUP BY sd.scenario_id
        ),
        scenario_data AS (
            SELECT 
                s.id as scenario_id,
                s.name as title,
                COALESCE(sps.problem_statement, '') as problem_statement,
                s.active,
                s.generated,
                s.updated_at,
                st.parent_id::text as parent_scenario_id,
                COALESCE(so.objective_ids, ARRAY[]::text[]) as objective_ids,
                COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
                COALESCE(spar.parameter_item_ids, ARRAY[]::uuid[]) as parameter_item_ids,
                COALESCE(ss.simulation_ids, ARRAY[]::uuid[]) as simulation_ids,
                COALESCE(ss.num_simulations, 0) as num_simulations,
                COALESCE(sc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
                COALESCE(sdd.department_ids, NULL) as department_ids,
                s.hints_enabled,
                s.objectives_enabled,
                s.image_input_enabled,
                s.copy_paste_allowed,
                s.input_guardrail_enabled,
                s.output_guardrail_enabled,
                CASE WHEN COUNT(sd.scenario_id) > 0 THEN true ELSE false END as has_dept_links,
                CASE 
                    WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                         AND COALESCE(ss.num_simulations, 0) = 0 
                    THEN true
                    ELSE false
                END as can_edit,
                CASE 
                    WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                         AND COALESCE(sal.total_links, 0) = 0 
                    THEN true
                    ELSE false
                END as can_delete,
                true as can_duplicate
            FROM scenarios s
            -- Only include root scenarios (parent_id = child_id in scenario_tree)
            JOIN scenario_tree root_check ON root_check.parent_id = s.id AND root_check.child_id = s.id
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
            LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            LEFT JOIN scenario_objectives so ON so.scenario_id = s.id
            LEFT JOIN scenario_parameters spar ON spar.scenario_id = s.id
            LEFT JOIN scenario_simulations ss ON ss.scenario_id = s.id
            LEFT JOIN scenario_all_simulation_links sal ON sal.scenario_id = s.id
            LEFT JOIN scenario_cohorts sc ON sc.scenario_id = s.id
            LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
            CROSS JOIN user_profile up
            GROUP BY s.id, s.name, sps.problem_statement, s.active, s.generated, s.updated_at, st.parent_id, 
                     so.objective_ids, spa.persona_ids, spar.parameter_item_ids, ss.simulation_ids, ss.num_simulations, 
                     sc.cohort_ids, sdd.department_ids, sal.total_links, up.role
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(sd.scenario_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
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
                        'parameter_name', p.name,
                        'value', COALESCE(pi.value, '')
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
            SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
            FROM scenario_data
            WHERE persona_ids IS NOT NULL
        ),
        persona_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', COALESCE(p.description, ''),
                        'color', p.color,
                        'icon', p.icon,
                        'image_model', COALESCE(m.image_model, false)
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM personas p
            LEFT JOIN models m ON m.id = p.model_id
            WHERE p.id IN (SELECT persona_id FROM all_persona_ids)
        ),
        all_simulation_ids AS (
            SELECT DISTINCT unnest(simulation_ids) as simulation_id
            FROM scenario_data
        ),
        simulation_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object(
                        'name', s.title,
                        'description', COALESCE(s.description, ''),
                        'time_limit', stl.time_limit_seconds,
                        'department_ids', CASE 
                            WHEN (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
                                  FROM simulation_departments sd
                                  WHERE sd.simulation_id = s.id AND sd.active = true) IS NOT NULL 
                            THEN to_jsonb((SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
                                           FROM simulation_departments sd
                                           WHERE sd.simulation_id = s.id AND sd.active = true))
                            ELSE NULL::jsonb
                        END
                    )
                ) FILTER (WHERE s.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM all_simulation_ids asi
            LEFT JOIN simulations s ON s.id = asi.simulation_id
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, '')
                    )
                ) FILTER (WHERE d.id IS NOT NULL),
                '{}'::jsonb
            ) as mapping
            FROM departments d
            WHERE d.id IN (SELECT department_id FROM user_departments)
        )
        SELECT 
            sd.*,
            om.mapping as objective_mapping,
            pim.mapping as parameter_item_mapping,
            cm.mapping as cohort_mapping,
            pm.mapping as persona_mapping,
            sm.mapping as simulation_mapping,
            dm.mapping as department_mapping
        FROM scenario_data sd
        CROSS JOIN objective_mapping_data om
        CROSS JOIN parameter_item_mapping_data pim
        CROSS JOIN cohort_mapping_data cm
        CROSS JOIN persona_mapping_data pm
        CROSS JOIN simulation_mapping_data sm
        CROSS JOIN department_mapping_data dm
        ORDER BY sd.updated_at DESC NULLS LAST
        """

        return (query, [profile_id])

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
            sps.problem_statement,
            s.active
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
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
            JOIN departments d ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND pd.active = true AND d.active = true
        ),
        scenario_departments_data AS (
            SELECT 
                sd.scenario_id,
                ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
            FROM scenario_departments sd
            WHERE sd.scenario_id = $1 AND sd.active = true
            GROUP BY sd.scenario_id
        ),
        scenario_active_problem_statement AS (
            SELECT 
                sps.scenario_id,
                sps.id::text as problem_statement_id,
                sps.problem_statement,
                sps.created_at as problem_statement_created_at,
                sps.updated_at as problem_statement_updated_at
            FROM scenario_problem_statements sps
            WHERE sps.scenario_id = $1 AND sps.active = true
            LIMIT 1
        ),
        scenario_all_problem_statements AS (
            SELECT 
                sps.scenario_id,
                sps.id::text as problem_statement_id,
                sps.problem_statement,
                sps.created_at as problem_statement_created_at,
                sps.updated_at as problem_statement_updated_at
            FROM scenario_problem_statements sps
            WHERE sps.scenario_id = $1
        ),
        problem_statement_mapping_data AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        sps.problem_statement_id,
                        jsonb_build_object(
                            'problem_statement', sps.problem_statement,
                            'created_at', sps.problem_statement_created_at::text,
                            'updated_at', sps.problem_statement_updated_at::text
                        )
                    ),
                    '{}'::jsonb
                ) as problem_statement_mapping
            FROM scenario_all_problem_statements sps
        ),
        scenario_core AS (
            SELECT 
                s.id,
                s.name,
                COALESCE(saps.problem_statement, '') as problem_statement,
                COALESCE(saps.problem_statement_id, NULL) as problem_statement_id,
                s.active,
                s.generated,
                st.parent_id::text as parent_scenario_id,
                COALESCE(sdd.department_ids, NULL) as department_ids,
                s.hints_enabled,
                s.objectives_enabled,
                s.image_input_enabled,
                s.copy_paste_allowed,
                s.input_guardrail_enabled,
                s.output_guardrail_enabled
            FROM scenarios s
            LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
            LEFT JOIN scenario_active_problem_statement saps ON saps.scenario_id = s.id
            LEFT JOIN scenario_departments_data sdd ON sdd.scenario_id = s.id
            WHERE s.id = $1
        ),
        scenario_personas_agg AS (
            SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
            FROM scenario_personas
            WHERE scenario_id = $1 AND active = true
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
        all_parameters_data AS (
            SELECT 
                p.id::text as param_id,
                COALESCE((
                    SELECT jsonb_agg(spi2.parameter_item_id::text ORDER BY spi2.parameter_item_id)
                    FROM scenario_parameter_items spi2
                    JOIN parameter_items pi2 ON pi2.id = spi2.parameter_item_id
                    WHERE spi2.scenario_id = $1 AND pi2.parameter_id = p.id AND spi2.active = true
                ), '[]'::jsonb) as selected_items,
                COALESCE((
                    SELECT jsonb_agg(id::text ORDER BY id::text)
                    FROM (
                        -- Get accessible items (same filtering as parameter_item_mapping)
                        SELECT pi3.id
                        FROM parameter_items pi3
                        LEFT JOIN parameter_item_departments pid3 ON pid3.parameter_item_id = pi3.id AND pid3.active = true
                        CROSS JOIN user_departments ud3
                        WHERE pi3.parameter_id = p.id
                        GROUP BY pi3.id
                        HAVING 
                            -- Include if has matching department link OR has no department links at all (cross-dept)
                            COUNT(pid3.parameter_item_id) FILTER (WHERE pid3.department_id = ANY(ud3.dept_ids)) > 0
                            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid4 WHERE pid4.parameter_item_id = pi3.id AND pid4.active = true)
                        UNION
                        -- Also include selected items (for edit mode - ensures selected items are available)
                        SELECT spi2.parameter_item_id as id
                        FROM scenario_parameter_items spi2
                        JOIN parameter_items pi2 ON pi2.id = spi2.parameter_item_id
                        WHERE spi2.scenario_id = $1 AND pi2.parameter_id = p.id AND spi2.active = true
                    ) combined_items
                ), '[]'::jsonb) as valid_items
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            CROSS JOIN user_departments ud
            WHERE p.active = true
            GROUP BY p.id
            HAVING 
                -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(ud.dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
        ),
        merged_parameters_data AS (
            SELECT 
                COALESCE(jsonb_object_agg(
                    param_id,
                    jsonb_build_object(
                        'parameter_item_ids', selected_items,
                        'valid_parameter_item_ids', valid_items
                    )
                ), '{}'::jsonb) as parameters_json
            FROM all_parameters_data
        ),
        all_parameter_item_ids AS (
            SELECT DISTINCT unnest(ARRAY(
                SELECT jsonb_array_elements_text(
                    value->'parameter_item_ids'
                )::uuid
                FROM merged_parameters_data, jsonb_each(parameters_json)
                WHERE jsonb_typeof(value->'parameter_item_ids') = 'array'
            )) as param_item_id
        ),
        valid_personas_filtered AS (
            SELECT DISTINCT
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.color,
                p.icon,
                m.image_model
            FROM personas p
            LEFT JOIN models m ON m.id = p.model_id
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            CROSS JOIN user_departments ud
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.color, p.icon, m.image_model
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY(ud.dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        ),
        persona_data AS (
            SELECT * FROM valid_personas_filtered
            UNION
            -- Also include currently selected personas (for edit mode - ensures selected items are available)
            SELECT DISTINCT
                p2.id,
                p2.name,
                COALESCE(p2.description, '') as description,
                p2.color,
                p2.icon,
                m2.image_model
            FROM scenario_personas_agg spa
            CROSS JOIN LATERAL unnest(spa.persona_ids) as persona_id
            JOIN personas p2 ON p2.id = persona_id::uuid
            LEFT JOIN models m2 ON m2.id = p2.model_id
            WHERE p2.active = true
            ORDER BY name
        ),
        valid_personas_data AS (
            SELECT 
                COALESCE(ARRAY_AGG(p.id::text ORDER BY p.name), ARRAY[]::text[]) as valid_persona_ids,
                COALESCE(jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', p.description,
                        'color', p.color,
                        'icon', p.icon,
                        'image_model', COALESCE(p.image_model, false)
                    )
                ), '{}'::jsonb) as persona_mapping
            FROM persona_data p
        ),
        valid_documents_filtered AS (
            SELECT DISTINCT
                d.id,
                d.name,
                d.type::text as description,
                d.file_path,
                d.mime_type
            FROM documents d
            LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
            CROSS JOIN user_departments ud
            WHERE d.active = true
            GROUP BY d.id, d.name, d.type, d.file_path, d.mime_type
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY(ud.dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        ),
        document_data AS (
            SELECT * FROM valid_documents_filtered
            UNION
            -- Also include currently selected documents (for edit mode - ensures selected items are available)
            SELECT DISTINCT
                d2.id,
                d2.name,
                d2.type::text as description,
                d2.file_path,
                d2.mime_type
            FROM scenario_documents_agg sda
            CROSS JOIN LATERAL unnest(sda.document_ids) as doc_id
            JOIN documents d2 ON d2.id = doc_id::uuid
            WHERE d2.active = true
            ORDER BY name
        ),
        valid_documents_data AS (
            SELECT 
                COALESCE(ARRAY_AGG(d.id::text ORDER BY d.name), ARRAY[]::text[]) as valid_document_ids,
                COALESCE(jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.name,
                        'description', d.description,
                        'filePath', d.file_path,
                        'mimeType', d.mime_type
                    )
                ), '{}'::jsonb) as document_mapping
            FROM document_data d
        ),
        scenario_documents_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.name,
                        'description', COALESCE(d.type::text, ''),
                        'filePath', d.file_path,
                        'mimeType', d.mime_type
                    )
                ),
                '{}'::jsonb
            ) as document_mapping
            FROM scenario_documents sd
            JOIN documents d ON d.id = sd.document_id
            WHERE sd.scenario_id = $1 AND sd.active = true AND d.active = true
        ),
        enhanced_document_mapping_data AS (
            SELECT 
                COALESCE(
                    (
                        SELECT jsonb_object_agg(key, value)
                        FROM (
                            SELECT key, value 
                            FROM jsonb_each(vdd.document_mapping)
                            UNION ALL
                            SELECT key, value 
                            FROM jsonb_each(sdmd.document_mapping)
                        ) combined
                    ),
                    '{}'::jsonb
                ) as document_mapping
            FROM valid_documents_data vdd
            CROSS JOIN scenario_documents_mapping_data sdmd
        ),
        document_details_data AS (
            SELECT COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'document_id', d.id::text,
                            'name', d.name,
                            'type', d.type,
                            'updatedAt', d.updated_at::text,
                            'extension', SUBSTRING(d.file_path FROM '\\.([^\\.]+)$'),
                            'scenario_ids', COALESCE((
                                SELECT jsonb_agg(sd2.scenario_id::text)
                                FROM scenario_documents sd2
                                WHERE sd2.document_id = d.id AND sd2.active = true
                            ), '[]'::jsonb),
                            'can_edit', true,
                            'can_delete', true,
                            'active', d.active,
                            'file_path', d.file_path,
                            'mime_type', d.mime_type,
                            'parameter_item_ids', COALESCE((
                                SELECT jsonb_agg(dpi.parameter_item_id::text)
                                FROM document_parameter_items dpi
                                WHERE dpi.document_id = d.id AND dpi.active = true
                            ), '[]'::jsonb)
                        ) ORDER BY d.name
                    )
                    FROM scenario_documents sd
                    JOIN documents d ON d.id = sd.document_id
                    WHERE sd.scenario_id = $1 AND sd.active = true
                ),
                '[]'::jsonb
            ) as document_details
        ),
        simulation_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                s.id::text,
                    jsonb_build_object(
                        'name', s.title, 
                        'description', COALESCE(s.description, ''),
                        'time_limit', stl.time_limit_seconds,
                        'department_ids', COALESCE(
                            (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
                             FROM simulation_departments sd
                             WHERE sd.simulation_id = s.id AND sd.active = true),
                            NULL
                        )
                    )
            ), '{}'::jsonb) as simulation_mapping
            FROM simulations s
            LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
            WHERE s.id = ANY(
                COALESCE((SELECT simulation_ids::uuid[] FROM scenario_simulations_agg), ARRAY[]::uuid[])
            )
        ),
        parameter_data_for_mapping AS (
            SELECT DISTINCT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.numerical
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            CROSS JOIN user_departments ud
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.numerical
            HAVING 
                -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(ud.dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
            ORDER BY p.name
        ),
        parameter_mapping_data AS (
            SELECT 
                COALESCE(jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object('name', p.name, 'description', p.description, 'numerical', p.numerical)
                ), '{}'::jsonb) as parameter_mapping
            FROM parameter_data_for_mapping p
        ),
        scenario_parameters_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object('name', p.name, 'description', COALESCE(p.description, ''), 'numerical', p.numerical)
                ),
                '{}'::jsonb
            ) as parameter_mapping
            FROM scenario_parameter_items spi
            JOIN parameter_items pi ON pi.id = spi.parameter_item_id
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE spi.scenario_id = $1 AND spi.active = true AND p.active = true
        ),
        enhanced_parameter_mapping_data AS (
            SELECT 
                COALESCE(
                    (
                        SELECT jsonb_object_agg(key, value)
                        FROM (
                            SELECT key, value 
                            FROM jsonb_each(pmd.parameter_mapping)
                            UNION ALL
                            SELECT key, value 
                            FROM jsonb_each(spmd.parameter_mapping)
                        ) combined
                    ),
                    '{}'::jsonb
                ) as parameter_mapping
            FROM parameter_mapping_data pmd
            CROSS JOIN scenario_parameters_mapping_data spmd
        ),
        parameter_item_data AS (
            SELECT 
                pi.id,
                pi.name,
                COALESCE(pi.description, '') as description,
                pi.parameter_id,
                p.name as parameter_name,
                pi.value
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            CROSS JOIN user_departments ud
            WHERE p.active = true
            GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, p.id, p.name, pi.value
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY(ud.dept_ids)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            ORDER BY p.name, pi.name
        ),
        parameter_item_mapping_data AS (
            SELECT 
                COALESCE(jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name,
                        'description', pi.description,
                        'parameter_id', pi.parameter_id::text,
                        'parameter_name', pi.parameter_name,
                        'value', pi.value
                    )
                ), '{}'::jsonb) as parameter_item_mapping
            FROM parameter_item_data pi
        ),
        scenario_parameter_items_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name,
                        'description', COALESCE(pi.description, ''),
                        'parameter_id', pi.parameter_id::text,
                        'parameter_name', p.name,
                        'value', pi.value
                    )
                ),
                '{}'::jsonb
            ) as parameter_item_mapping
            FROM scenario_parameter_items spi
            JOIN parameter_items pi ON pi.id = spi.parameter_item_id
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE spi.scenario_id = $1 AND spi.active = true AND p.active = true
        ),
        enhanced_parameter_item_mapping_data AS (
            SELECT 
                COALESCE(
                    (
                        SELECT jsonb_object_agg(key, value)
                        FROM (
                            SELECT key, value 
                            FROM jsonb_each(pimd.parameter_item_mapping)
                            UNION ALL
                            SELECT key, value 
                            FROM jsonb_each(spimd.parameter_item_mapping)
                        ) combined
                    ),
                    '{}'::jsonb
                ) as parameter_item_mapping
            FROM parameter_item_mapping_data pimd
            CROSS JOIN scenario_parameter_items_mapping_data spimd
        ),
        department_persona_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(p.id::text ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as persona_ids
            FROM departments d
            CROSS JOIN user_departments ud
            -- Only include personas accessible to user (from valid_personas_filtered logic)
            LEFT JOIN personas p ON p.active = true
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE d.id = ANY(ud.dept_ids)
            -- Include persona if linked to this specific department
            AND (
                pd.department_id = d.id 
                -- OR persona is cross-department (no department links) - include in ALL departments
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            )
            -- Also ensure persona is accessible to user (has matching department link OR is cross-department)
            AND (
                pd.department_id = ANY(ud.dept_ids)
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd3 WHERE pd3.persona_id = p.id AND pd3.active = true)
            )
            GROUP BY d.id
        ),
        department_document_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(doc.id::text ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::text[]) as document_ids
            FROM departments d
            CROSS JOIN user_departments ud
            LEFT JOIN documents doc ON doc.active = true
            LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
            WHERE d.id = ANY(ud.dept_ids)
            AND (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
            GROUP BY d.id
        ),
        department_parameter_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
            FROM departments d
            CROSS JOIN user_departments ud
            LEFT JOIN parameters p ON p.active = true
            LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE d.id = ANY(ud.dept_ids)
            AND (pid.department_id = d.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                         JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                         WHERE pi2.parameter_id = p.id AND pid2.active = true))
            GROUP BY d.id
        ),
        department_parameter_item_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(pi.id::text ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
            FROM departments d
            CROSS JOIN user_departments ud
            -- Join with parameters to ensure we only include items from active parameters
            LEFT JOIN parameter_items pi ON true
            LEFT JOIN parameters p ON p.id = pi.parameter_id AND p.active = true
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE d.id = ANY(ud.dept_ids)
            AND p.id IS NOT NULL  -- Only include items from active parameters
            -- Include parameter item if linked to this specific department
            AND (
                pid.department_id = d.id 
                -- OR parameter item is cross-department (no department links) - include in ALL departments
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            )
            -- Also ensure parameter item is accessible to user (has matching department link OR is cross-department)
            AND (
                pid.department_id = ANY(ud.dept_ids)
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid3 WHERE pid3.parameter_item_id = pi.id AND pid3.active = true)
            )
            GROUP BY d.id
        ),
        department_agent_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(a.id::text ORDER BY a.id) FILTER (WHERE a.id IS NOT NULL), ARRAY[]::text[]) as agent_ids
            FROM departments d
            CROSS JOIN user_departments ud
            LEFT JOIN agents a ON a.active = true
            LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
            WHERE d.id = ANY(ud.dept_ids)
            AND (ad.department_id = d.id OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true))
            GROUP BY d.id
        ),
        department_staff_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(p.id::text ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as staff_ids
            FROM departments d
            CROSS JOIN user_departments ud
            LEFT JOIN profile_departments pd ON pd.department_id = d.id
            LEFT JOIN profiles p ON p.id = pd.profile_id
            WHERE d.id = ANY(ud.dept_ids)
            GROUP BY d.id
        ),
        department_cohort_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(c.id::text ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::text[]) as cohort_ids
            FROM departments d
            CROSS JOIN user_departments ud
            LEFT JOIN cohorts c ON c.active = true
            LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
            WHERE d.id = ANY(ud.dept_ids)
            AND (cd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
            GROUP BY d.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, ''),
                    'persona_ids', CASE WHEN dpi.persona_ids IS NOT NULL AND array_length(dpi.persona_ids, 1) > 0 THEN to_jsonb(dpi.persona_ids) ELSE NULL END,
                    'document_ids', CASE WHEN ddi.document_ids IS NOT NULL AND array_length(ddi.document_ids, 1) > 0 THEN to_jsonb(ddi.document_ids) ELSE NULL END,
                    'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
                    'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
                )
            ), '{}'::jsonb) as department_mapping
            FROM departments d
            CROSS JOIN user_departments ud
            LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
            LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
            LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
            LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
            WHERE d.id = ANY(ud.dept_ids)
        ),
        scenario_departments_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, ''),
                        'persona_ids', NULL,
                        'document_ids', NULL,
                        'parameter_ids', NULL,
                        'parameter_item_ids', NULL
                    )
                ),
                '{}'::jsonb
            ) as department_mapping
            FROM scenario_departments sd
            JOIN departments d ON d.id = sd.department_id
            WHERE sd.scenario_id = $1 AND sd.active = true AND d.active = true
        ),
        enhanced_department_mapping_data AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        dept_key,
                        -- Merge: start with department_mapping_data values, overlay scenario-specific fields
                        -- But preserve non-NULL arrays from department_mapping_data
                        COALESCE(dmd.value, '{}'::jsonb) || 
                        COALESCE(sdmdept.value, '{}'::jsonb) ||
                        -- Explicitly preserve arrays from department_mapping_data (don't let NULL overwrite)
                        jsonb_build_object(
                            'persona_ids', COALESCE(dmd.value->'persona_ids', sdmdept.value->'persona_ids'),
                            'document_ids', COALESCE(dmd.value->'document_ids', sdmdept.value->'document_ids'),
                            'parameter_ids', COALESCE(dmd.value->'parameter_ids', sdmdept.value->'parameter_ids'),
                            'parameter_item_ids', COALESCE(dmd.value->'parameter_item_ids', sdmdept.value->'parameter_item_ids'),
                            'agent_ids', COALESCE(dmd.value->'agent_ids', sdmdept.value->'agent_ids'),
                            'staff_ids', COALESCE(dmd.value->'staff_ids', sdmdept.value->'staff_ids'),
                            'cohort_ids', COALESCE(dmd.value->'cohort_ids', sdmdept.value->'cohort_ids')
                        )
                    ),
                    '{}'::jsonb
                ) as department_mapping
            FROM (
                SELECT DISTINCT dept_key
                FROM (
                    SELECT key as dept_key FROM jsonb_each((SELECT department_mapping FROM department_mapping_data))
                    UNION
                    SELECT key as dept_key FROM jsonb_each((SELECT department_mapping FROM scenario_departments_mapping_data))
                ) all_keys
            ) keys
            LEFT JOIN LATERAL (
                SELECT value FROM jsonb_each((SELECT department_mapping FROM department_mapping_data)) WHERE key = keys.dept_key
            ) dmd ON true
            LEFT JOIN LATERAL (
                SELECT value FROM jsonb_each((SELECT department_mapping FROM scenario_departments_mapping_data)) WHERE key = keys.dept_key
            ) sdmdept ON true
        ),
        accessible_scenarios AS (
            SELECT DISTINCT s.id as scenario_id
            FROM scenarios s
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            CROSS JOIN user_departments ud
            WHERE s.active = true
            AND (
                -- Include if scenario is linked to user's accessible departments
                sd.department_id = ANY(ud.dept_ids)
                -- OR scenario has no department links (cross-department) - accessible to all
                OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
            )
        ),
        objectives_with_departments AS (
            SELECT
                so.objective,
                COALESCE(
                    (
                        SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
                        FROM (
                            SELECT DISTINCT sd.department_id::text as dept_id
                            FROM scenario_objectives so2
                            JOIN accessible_scenarios acs2 ON acs2.scenario_id = so2.scenario_id
                            LEFT JOIN scenario_departments sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                            WHERE so2.objective = so.objective
                                AND so2.objective IS NOT NULL 
                                AND so2.objective != ''
                                AND sd.department_id IS NOT NULL
                        ) dept_list
                    ),
                    ARRAY[]::text[]
                ) as department_ids
            FROM scenario_objectives so
            JOIN accessible_scenarios acs ON acs.scenario_id = so.scenario_id
            WHERE so.objective IS NOT NULL AND so.objective != ''
            GROUP BY so.objective
        ),
        objectives_history_data AS (
            SELECT COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'objective', objective,
                            'department_ids', department_ids
                        )
                    )
                    FROM (
                        SELECT objective, department_ids
                        FROM objectives_with_departments
                        ORDER BY objective
                    ) sorted
                ),
                '[]'::jsonb
            ) as objectives_history
        )
        SELECT 
            sc.id,
            sc.name,
            sc.problem_statement,
            sc.problem_statement_id,
            sc.active,
            sc.generated,
            sc.department_ids,
            sc.parent_scenario_id,
            sc.hints_enabled,
            sc.objectives_enabled,
            sc.image_input_enabled,
            sc.copy_paste_allowed,
            sc.input_guardrail_enabled,
            sc.output_guardrail_enabled,
            COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
            COALESCE(sd.document_ids, ARRAY[]::text[]) as document_ids,
            COALESCE(sod.objective_ids, ARRAY[]::text[]) as objective_ids,
            COALESCE(ssa.simulation_ids, ARRAY[]::text[]) as simulation_ids,
            COALESCE(mpd.parameters_json, '{}'::jsonb) as parameters_json,
            COALESCE(vpd2.valid_persona_ids, ARRAY[]::text[]) as valid_persona_ids,
            COALESCE(vdd.valid_document_ids, ARRAY[]::text[]) as valid_document_ids,
            (SELECT dept_ids FROM user_departments) as valid_department_ids,
            COALESCE(ssa.active_usage_count, 0) as active_usage_count,
            up.role as user_role,
            sod.objective_mapping,
            vpd2.persona_mapping,
            COALESCE(edmd.document_mapping, vdd.document_mapping) as document_mapping,
            smd.simulation_mapping,
            COALESCE(epmd.parameter_mapping, pmd.parameter_mapping) as parameter_mapping,
            COALESCE(epimd.parameter_item_mapping, pimd.parameter_item_mapping) as parameter_item_mapping,
            COALESCE(edmdept.department_mapping, dmd.department_mapping) as department_mapping,
            ddd.document_details,
            COALESCE(psmd.problem_statement_mapping, '{}'::jsonb) as problem_statement_mapping,
            COALESCE(ohd.objectives_history, '[]'::jsonb) as objectives_history
        FROM scenario_core sc
        CROSS JOIN user_profile up
        LEFT JOIN scenario_personas_agg spa ON true
        LEFT JOIN scenario_documents_agg sd ON true
        LEFT JOIN scenario_objectives_data sod ON true
        LEFT JOIN scenario_simulations_agg ssa ON true
        CROSS JOIN merged_parameters_data mpd
        CROSS JOIN valid_personas_data vpd2
        CROSS JOIN valid_documents_data vdd
        CROSS JOIN scenario_documents_mapping_data sdmd
        CROSS JOIN enhanced_document_mapping_data edmd
        CROSS JOIN document_details_data ddd
        CROSS JOIN simulation_mapping_data smd
        CROSS JOIN parameter_mapping_data pmd
        CROSS JOIN scenario_parameters_mapping_data spmd
        CROSS JOIN enhanced_parameter_mapping_data epmd
        CROSS JOIN parameter_item_mapping_data pimd
        CROSS JOIN scenario_parameter_items_mapping_data spimd
        CROSS JOIN enhanced_parameter_item_mapping_data epimd
        CROSS JOIN department_mapping_data dmd
        CROSS JOIN scenario_departments_mapping_data sdmdept
        CROSS JOIN enhanced_department_mapping_data edmdept
        CROSS JOIN problem_statement_mapping_data psmd
        CROSS JOIN objectives_history_data ohd
        """
        return (query, [scenario_id, profile_id])

    def get_scenario_personas(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's personas."""
        query = """
        SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
        FROM scenario_personas 
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
        SELECT DISTINCT p.id, p.name 
        FROM personas p
        LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
        WHERE p.active = true
        GROUP BY p.id, p.name
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        ORDER BY p.name
        """
        return (query, [dept_ids])

    def get_valid_documents(self, dept_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for valid documents."""
        query = """
        SELECT DISTINCT d.id, d.name 
        FROM documents d
        LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
        WHERE d.active = true
        GROUP BY d.id, d.name
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1)) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        ORDER BY d.name
        """
        return (query, [dept_ids])

    def get_simulation_mapping(self, sim_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query for simulation mapping."""
        query = """
        SELECT 
            s.id, 
            s.title, 
            s.description,
            stl.time_limit_seconds as time_limit
        FROM simulations s
        LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        WHERE s.id = ANY($1)
        """
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
            SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
            FROM profile_departments pd
            WHERE pd.profile_id = $1
        )
        SELECT s.id
        FROM scenarios s
        LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
        WHERE s.active = true
        GROUP BY s.id
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(sd.scenario_id) FILTER (WHERE sd.department_id = ANY((SELECT dept_ids FROM user_departments))) > 0
            OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
        ORDER BY s.created_at DESC
        LIMIT 1
        """
        return (query, [profile_id])

    def create_scenario(self) -> str:
        """Build query to create scenario.

        Params order: name, active, hints_enabled, objectives_enabled, 
        image_input_enabled, copy_paste_allowed, input_guardrail_enabled, output_guardrail_enabled
        """
        return """
        INSERT INTO scenarios (
            name,
            active,
            hints_enabled,
            objectives_enabled,
            image_input_enabled,
            copy_paste_allowed,
            input_guardrail_enabled,
            output_guardrail_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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

        Params order: name, active, hints_enabled, objectives_enabled, 
        image_input_enabled, input_guardrail_enabled, output_guardrail_enabled, scenario_id
        Note: problem_statement is handled separately via create_scenario_problem_statement()
        """
        return """
        UPDATE scenarios SET
            name = $1,
            active = $2,
            hints_enabled = $3,
            objectives_enabled = $4,
            image_input_enabled = $5,
            copy_paste_allowed = $6,
            input_guardrail_enabled = $7,
            output_guardrail_enabled = $8,
            updated_at = NOW()
        WHERE id = $9
        """

    def delete_scenario_departments(
        self, scenario_id: str
    ) -> tuple[str, list[Any]]:
        """Build query to deactivate all scenario departments."""
        query = """
        UPDATE scenario_departments 
        SET active = false, updated_at = NOW()
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def create_scenario_departments(
        self, scenario_id: str, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to create scenario-department junction table records.
        
        Returns:
            Tuple of (query, params)
        """
        if not department_ids:
            # Return empty query if no departments
            return "SELECT 1 WHERE false", []

        # Use UNNEST for efficient batch insert
        query = """
        INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
        SELECT $1, dept_id::uuid, true, NOW(), NOW()
        FROM UNNEST($2::text[]) as dept_id
        ON CONFLICT (scenario_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
        """

        params: list[Any] = [scenario_id, department_ids]
        return query, params

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
            s.name,
            s.active,
            sps.problem_statement,
            s.hints_enabled,
            s.objectives_enabled,
            s.image_input_enabled,
            s.copy_paste_allowed,
            s.input_guardrail_enabled,
            s.output_guardrail_enabled
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        WHERE s.id = $1
        """
        return (query, [scenario_id])

    def insert_duplicate_scenario(self) -> str:
        """Build query to insert duplicate scenario.

        Params order: name, hints_enabled, objectives_enabled, 
        image_input_enabled, copy_paste_allowed, input_guardrail_enabled, output_guardrail_enabled
        """
        return """
        INSERT INTO scenarios (
            name,
            active,
            hints_enabled,
            objectives_enabled,
            image_input_enabled,
            copy_paste_allowed,
            input_guardrail_enabled,
            output_guardrail_enabled
        )
        VALUES (
            $1 || ' Copy',
            false,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
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

    def copy_scenario_problem_statements(self) -> str:
        """Build query to copy scenario problem statements.

        Params order: new_scenario_id, original_scenario_id
        """
        return """
        INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active)
        SELECT $1, problem_statement, active
        FROM scenario_problem_statements
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
            sps.problem_statement as description,
            COALESCE((
                SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
                FROM scenario_personas
                WHERE scenario_id = s.id AND active = true
            ), ARRAY[]::text[]) as persona_ids,
            COALESCE(
                (SELECT ARRAY_AGG(DISTINCT spi.parameter_item_id)
                 FROM scenario_parameter_items spi
                 WHERE spi.scenario_id = s.id AND spi.active = true),
                ARRAY[]::uuid[]
            ) as parameter_item_ids
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        WHERE s.id = ANY($1)
        """
        return (query, [scenario_ids])

    def get_enhanced_scenario_mapping_complete(
        self, scenario_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build complete enhanced scenario mapping in ONE query with all nested data.

        Consolidates 5 queries into 1:
        - Base scenario data (from get_enhanced_scenario_mapping)
        - Document IDs per scenario (from get_scenario_documents_aggregated)
        - Persona mapping (from get_persona_mapping)
        - Document mapping (from get_documents_mapping)
        - Parameter item mapping (from get_parameter_item_mapping)

        Returns all data as rows with JSONB mappings embedded.

        Args:
            scenario_ids: List of scenario IDs to fetch

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH scenarios_base AS (
            SELECT 
                s.id as scenario_id,
                s.name,
                sps.problem_statement as description,
                COALESCE((
                    SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
                    FROM scenario_personas
                    WHERE scenario_id = s.id AND active = true
                ), ARRAY[]::text[]) as persona_ids,
                COALESCE(
                    (SELECT ARRAY_AGG(DISTINCT spi.parameter_item_id)
                     FROM scenario_parameter_items spi
                     WHERE spi.scenario_id = s.id AND spi.active = true),
                    ARRAY[]::uuid[]
                ) as parameter_item_ids
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
            WHERE s.id = ANY($1)
        ),
        scenario_documents AS (
            SELECT 
                scenario_id,
                COALESCE(ARRAY_AGG(document_id ORDER BY document_id), ARRAY[]::uuid[]) as document_ids
            FROM scenario_documents
            WHERE scenario_id = ANY($1) AND active = true
            GROUP BY scenario_id
        ),
        all_document_ids AS (
            SELECT DISTINCT unnest(document_ids) as document_id
            FROM scenario_documents
        ),
        all_persona_ids AS (
            SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
            FROM scenarios_base
            WHERE persona_ids IS NOT NULL AND array_length(persona_ids, 1) > 0
        ),
        all_param_item_ids AS (
            SELECT DISTINCT unnest(parameter_item_ids) as param_item_id
            FROM scenarios_base
            WHERE parameter_item_ids IS NOT NULL AND array_length(parameter_item_ids, 1) > 0
        ),
        persona_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', COALESCE(p.description, ''),
                        'color', p.color,
                        'icon', p.icon,
                        'image_model', COALESCE(m.image_model, false)
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '{}'::jsonb
            ) as persona_mapping
            FROM personas p
            LEFT JOIN models m ON m.id = p.model_id
            WHERE p.id IN (SELECT persona_id FROM all_persona_ids)
        ),
        document_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.name,
                        'description', COALESCE(d.type::text, '')
                    )
                ) FILTER (WHERE d.id IS NOT NULL),
                '{}'::jsonb
            ) as document_mapping
            FROM documents d
            WHERE d.id IN (SELECT document_id FROM all_document_ids)
        ),
        param_item_mapping_data AS (
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
            ) as param_item_mapping
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE pi.id IN (SELECT param_item_id FROM all_param_item_ids)
        )
        SELECT 
            sb.scenario_id,
            sb.name,
            sb.description,
            sb.persona_ids,
            sb.parameter_item_ids,
            COALESCE(sd.document_ids, ARRAY[]::uuid[]) as document_ids,
            pm.persona_mapping,
            dm.document_mapping,
            pim.param_item_mapping
        FROM scenarios_base sb
        LEFT JOIN scenario_documents sd ON sd.scenario_id = sb.scenario_id
        CROSS JOIN persona_mapping_data pm
        CROSS JOIN document_mapping_data dm
        CROSS JOIN param_item_mapping_data pim
        ORDER BY sb.name
        """
        return (query, [scenario_ids])

    # Queries for randomly_fill_scenario_attributes
    def get_scenario_departments(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get all department_ids from scenario_departments junction table."""
        query = """
        SELECT department_id
        FROM scenario_departments
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_scenario_persona_links(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Build query to get scenario's active persona links."""
        query = """
        SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
        FROM scenario_personas
        WHERE scenario_id = $1 AND active = true
        """
        return (query, [scenario_id])

    def get_active_personas(
        self, department_id: str | None = None, department_ids: list[str] | None = None
    ) -> tuple[str, list[Any]]:
        """Build query to get active personas, optionally filtered by department(s)."""
        if department_ids and len(department_ids) > 0:
            query = """
            SELECT p.id
            FROM personas p
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE p.active = true
            GROUP BY p.id
            HAVING 
                COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($1::uuid[])) > 0
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            """
            return (query, [department_ids])
        elif department_id:
            query = """
            SELECT p.id
            FROM personas p
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE p.active = true
            GROUP BY p.id
            HAVING 
                COUNT(pd.persona_id) FILTER (WHERE pd.department_id = $1::uuid) > 0
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            """
            return (query, [department_id])
        else:
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

    def get_active_documents(
        self, department_id: str | None = None, department_ids: list[str] | None = None
    ) -> tuple[str, list[Any]]:
        """Build query to get active documents with details, optionally filtered by department(s)."""
        if department_ids and len(department_ids) > 0:
            query = """
            SELECT d.id, d.name, d.type, d.file_path
            FROM documents d
            LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
            WHERE d.active = true
            GROUP BY d.id, d.name, d.type, d.file_path
            HAVING 
                COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1::uuid[])) > 0
                OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
            """
            return (query, [department_ids])
        elif department_id:
            query = """
            SELECT d.id, d.name, d.type, d.file_path
            FROM documents d
            LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
            WHERE d.active = true
            GROUP BY d.id, d.name, d.type, d.file_path
            HAVING 
                COUNT(dd.document_id) FILTER (WHERE dd.department_id = $1::uuid) > 0
                OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
            """
            return (query, [department_id])
        else:
            query = "SELECT id, name, type, file_path FROM documents WHERE active = true"
            return (query, [])

    def get_active_parameters(
        self, department_id: str | None = None, department_ids: list[str] | None = None
    ) -> tuple[str, list[Any]]:
        """Build query to get active parameters, optionally filtered by department(s) via parameter_items."""
        if department_ids and len(department_ids) > 0:
            query = """
            SELECT DISTINCT p.id, p.name, p.description, p.document_parameter
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.document_parameter
            HAVING 
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
            """
            return (query, [department_ids])
        elif department_id:
            query = """
            SELECT DISTINCT p.id, p.name, p.description, p.document_parameter
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.document_parameter
            HAVING 
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = $1::uuid) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
            """
            return (query, [department_id])
        else:
            query = "SELECT id, name, description, document_parameter FROM parameters WHERE active = true"
            return (query, [])

    def get_parameter_items_by_parameter(
        self, parameter_id: str, department_id: str | None = None
    ) -> tuple[str, list[Any]]:
        """Build query to get parameter items for a parameter, optionally filtered by department."""
        if department_id:
            query = """
            SELECT pi.id, pi.name
            FROM parameter_items pi
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE pi.parameter_id = $1
            GROUP BY pi.id, pi.name
            HAVING 
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = $2::uuid) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            """
            return (query, [parameter_id, department_id])
        else:
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

        Params order: name, generated, active, hints_enabled, objectives_enabled,
        image_input_enabled, copy_paste_allowed, input_guardrail_enabled, output_guardrail_enabled
        """
        return """
        INSERT INTO scenarios (name, generated, active, hints_enabled, objectives_enabled, 
        image_input_enabled, copy_paste_allowed, input_guardrail_enabled, output_guardrail_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        """

    def insert_scenario_problem_statement(self) -> str:
        """Build query to insert a scenario problem statement.

        Params order: scenario_id, problem_statement, active
        """
        return """
        INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active)
        VALUES ($1, $2, $3)
        RETURNING *
        """

    def deactivate_scenario_problem_statements(
        self, scenario_id: str
    ) -> tuple[str, list[Any]]:
        """
        Deactivate all active problem statements for a scenario.
        
        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE scenario_problem_statements
        SET active = false, updated_at = NOW()
        WHERE scenario_id = $1::uuid AND active = true
        """
        params: list[Any] = [scenario_id]
        return query, params

    def create_scenario_problem_statement(
        self, scenario_id: str, problem_statement: str
    ) -> tuple[str, list[Any]]:
        """
        Create a new problem statement for a scenario.
        Note: Call deactivate_scenario_problem_statements first to deactivate existing active ones.

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO scenario_problem_statements (scenario_id, problem_statement, active, created_at, updated_at)
        VALUES ($1::uuid, $2, true, NOW(), NOW())
        RETURNING id
        """
        params: list[Any] = [scenario_id, problem_statement]
        return query, params

    def insert_scenario_tree_edge(self) -> str:
        """Build query to insert scenario tree edge.

        Params order: parent_id, child_id, active
        """
        return """
        INSERT INTO scenario_tree (parent_id, child_id, active)
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
                sps.problem_statement,
                s.default_scenario,
                COALESCE((
                    SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
                    FROM scenario_personas
                    WHERE scenario_id = s.id AND active = true
                ), ARRAY[]::text[]) as persona_ids
            FROM scenarios s
            LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
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
            s.id, s.name, sps.problem_statement, 
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
            -- Persona IDs (array from junction)
            COALESCE((
                SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
                FROM scenario_personas 
                WHERE scenario_id = s.id AND active = true
            ), ARRAY[]::text[]) as persona_ids
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        LEFT JOIN simulation_scenarios ss ON ss.scenario_id = s.id
        LEFT JOIN simulations sim ON sim.id = ss.simulation_id
        WHERE s.id = $1
        GROUP BY s.id, s.name, sps.problem_statement, 
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
        SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description, p.color, p.icon 
        FROM personas p
        LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
        WHERE p.active = true
        GROUP BY p.id, p.name, p.description, p.color, p.icon
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($1::uuid[])) > 0
            OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
        ORDER BY p.name
        """
        return (query, [department_ids])

    def get_valid_documents_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get valid documents for departments."""
        query = """
        SELECT DISTINCT d.id, d.name, d.type::text as description 
        FROM documents d
        LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
        WHERE d.active = true
        GROUP BY d.id, d.name, d.type
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1::uuid[])) > 0
            OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
        ORDER BY d.name
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
            sps.problem_statement,
            s.active,
            COALESCE(s.generated, false) as generated,
            st.parent_id::text as parent_scenario_id
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        LEFT JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id != st.child_id
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
        """Build query to get active parameters for departments (via parameter_items)."""
        query = """
        SELECT DISTINCT p.id, p.name, p.description
        FROM parameters p
        JOIN parameter_items pi ON pi.parameter_id = p.id
        LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
        WHERE p.active = true
        GROUP BY p.id, p.name, p.description
        HAVING 
            -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
            COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                          JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                          WHERE pi2.parameter_id = p.id AND pid2.active = true)
        ORDER BY p.name
        """
        return (query, [department_ids])

    def get_active_parameter_items_for_departments(
        self, department_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Build query to get active parameter items with parameter name (filtered by parameter_item_departments)."""
        query = """
        SELECT DISTINCT pi.id, pi.name, pi.description, pi.parameter_id, p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
        WHERE pi.active = true
        GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, p.name
        HAVING 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
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
            WHERE pd.profile_id = $1 AND pd.active = true AND d.active = true
        ),
        department_persona_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(p.id::text ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as persona_ids
            FROM departments d
            INNER JOIN user_departments ud ON d.id = ud.id
            LEFT JOIN personas p ON p.active = true
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE (
                -- Include persona if linked to this specific department
                pd.department_id = d.id 
                -- OR persona is cross-department (no department links) - include in all departments
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            )
            GROUP BY d.id
        ),
        department_document_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(doc.id::text ORDER BY doc.id) FILTER (WHERE doc.id IS NOT NULL), ARRAY[]::text[]) as document_ids
            FROM departments d
            INNER JOIN user_departments ud ON d.id = ud.id
            LEFT JOIN documents doc ON doc.active = true
            LEFT JOIN document_departments dd ON dd.document_id = doc.id AND dd.active = true
            WHERE (dd.department_id = d.id OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = doc.id AND dd2.active = true))
            GROUP BY d.id
        ),
        department_parameter_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
            FROM departments d
            INNER JOIN user_departments ud ON d.id = ud.id
            LEFT JOIN parameters p ON p.active = true
            LEFT JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE (pid.department_id = d.id OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                                         JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                                         WHERE pi2.parameter_id = p.id AND pid2.active = true))
            GROUP BY d.id
        ),
        department_parameter_item_ids AS (
            SELECT 
                d.id as department_id,
                COALESCE(ARRAY_AGG(pi.id::text ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), ARRAY[]::text[]) as parameter_item_ids
            FROM departments d
            INNER JOIN user_departments ud ON d.id = ud.id
            LEFT JOIN parameter_items pi ON true
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE (
                -- Include parameter item if linked to this specific department
                pid.department_id = d.id 
                -- OR parameter item is cross-department (no department links) - include in all departments
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            )
            GROUP BY d.id
        ),
        department_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, ''),
                        'persona_ids', CASE WHEN dpi.persona_ids IS NOT NULL AND array_length(dpi.persona_ids, 1) > 0 THEN to_jsonb(dpi.persona_ids) ELSE NULL END,
                        'document_ids', CASE WHEN ddi.document_ids IS NOT NULL AND array_length(ddi.document_ids, 1) > 0 THEN to_jsonb(ddi.document_ids) ELSE NULL END,
                        'parameter_ids', CASE WHEN dparami.parameter_ids IS NOT NULL AND array_length(dparami.parameter_ids, 1) > 0 THEN to_jsonb(dparami.parameter_ids) ELSE NULL END,
                        'parameter_item_ids', CASE WHEN dparamitems.parameter_item_ids IS NOT NULL AND array_length(dparamitems.parameter_item_ids, 1) > 0 THEN to_jsonb(dparamitems.parameter_item_ids) ELSE NULL END
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM departments d
            INNER JOIN user_departments ud ON d.id = ud.id
            LEFT JOIN department_persona_ids dpi ON dpi.department_id = d.id
            LEFT JOIN department_document_ids ddi ON ddi.department_id = d.id
            LEFT JOIN department_parameter_ids dparami ON dparami.department_id = d.id
            LEFT JOIN department_parameter_item_ids dparamitems ON dparamitems.department_id = d.id
        ),
        persona_data AS (
            SELECT 
                p.id,
                p.name,
                COALESCE(p.description, '') as description,
                p.color,
                p.icon,
                m.image_model
            FROM personas p
            LEFT JOIN models m ON m.id = p.model_id
            LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.color, p.icon, m.image_model
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pd.persona_id) FILTER (WHERE pd.department_id IN (SELECT id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
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
                        'icon', p.icon,
                        'image_model', COALESCE(p.image_model, false)
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
            LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
            WHERE d.active = true
            GROUP BY d.id, d.name, d.type
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(dd.document_id) FILTER (WHERE dd.department_id IN (SELECT id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
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
                COALESCE(p.description, '') as description,
                p.numerical,
                p.document_parameter
            FROM parameters p
            JOIN parameter_items pi ON pi.parameter_id = p.id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
            GROUP BY p.id, p.name, p.description, p.numerical, p.document_parameter
            HAVING 
                -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                              JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                              WHERE pi2.parameter_id = p.id AND pid2.active = true)
            ORDER BY p.name
        ),
        parameter_mapping_data AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', p.description,
                        'numerical', p.numerical,
                        'document_parameter', p.document_parameter
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
                p.name as parameter_name,
                pi.value
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
            WHERE p.active = true
            GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, p.id, p.name, pi.value
            HAVING 
                -- Include if has matching department link OR has no department links at all (cross-dept)
                COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
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
                        'parameter_name', pi.parameter_name,
                        'value', pi.value
                    )
                ),
                '{}'::jsonb
            ) as mapping
            FROM parameter_item_data pi
        ),
        parameters_structure AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    pd.id::text,
                    jsonb_build_object(
                        'parameter_item_ids', '[]'::jsonb,
                        'valid_parameter_item_ids', COALESCE((
                            SELECT jsonb_agg(pi.id::text ORDER BY pi.id)
                            FROM parameter_items pi
                            WHERE pi.parameter_id = pd.id
                        ), '[]'::jsonb)
                    )
                ),
                '{}'::jsonb
            ) as parameters_json
            FROM parameter_data pd
        ),
        document_details_data AS (
            SELECT '[]'::jsonb as document_details
        ),
        accessible_scenarios_default AS (
            SELECT DISTINCT s.id as scenario_id
            FROM scenarios s
            LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
            WHERE s.active = true
            AND (
                -- Include if scenario is linked to user's accessible departments
                sd.department_id IN (SELECT id FROM user_departments)
                -- OR scenario has no department links (cross-department) - accessible to all
                OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
            )
        ),
        objectives_with_departments_default AS (
            SELECT
                so.objective,
                COALESCE(
                    (
                        SELECT ARRAY_AGG(DISTINCT dept_id ORDER BY dept_id)
                        FROM (
                            SELECT DISTINCT sd.department_id::text as dept_id
                            FROM scenario_objectives so2
                            JOIN accessible_scenarios_default acs2 ON acs2.scenario_id = so2.scenario_id
                            LEFT JOIN scenario_departments sd ON sd.scenario_id = so2.scenario_id AND sd.active = true
                            WHERE so2.objective = so.objective
                                AND so2.objective IS NOT NULL 
                                AND so2.objective != ''
                                AND sd.department_id IS NOT NULL
                        ) dept_list
                    ),
                    ARRAY[]::text[]
                ) as department_ids
            FROM scenario_objectives so
            JOIN accessible_scenarios_default acs ON acs.scenario_id = so.scenario_id
            WHERE so.objective IS NOT NULL AND so.objective != ''
            GROUP BY so.objective
        ),
        objectives_history_data_default AS (
            SELECT COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'objective', objective,
                            'department_ids', department_ids
                        )
                    )
                    FROM (
                        SELECT objective, department_ids
                        FROM objectives_with_departments_default
                        ORDER BY objective
                    ) sorted
                ),
                '[]'::jsonb
            ) as objectives_history
        ),
        problem_statement_mapping_data_default AS (
            SELECT '{}'::jsonb as problem_statement_mapping
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
            (SELECT mapping FROM parameter_item_mapping_data) as parameter_item_mapping,
            (SELECT parameters_json FROM parameters_structure) as parameters_json,
            (SELECT document_details FROM document_details_data) as document_details,
            (SELECT problem_statement_mapping FROM problem_statement_mapping_data_default) as problem_statement_mapping,
            (SELECT objectives_history FROM objectives_history_data_default) as objectives_history
        """
        return (query, [profile_id])

    # ===== New queries for scenario attribute selection logic =====

    def get_documents_by_parameter_items(self, parameter_item_ids: list[str]) -> tuple[str, list[Any]]:
        """Get documents that match given parameter items via document_parameter_items junction."""
        query = """
        SELECT DISTINCT d.id, d.name, d.type, d.file_path
        FROM documents d
        JOIN document_parameter_items dpi ON dpi.document_id = d.id
        WHERE dpi.parameter_item_id = ANY($1::uuid[]) 
          AND dpi.active = true
          AND d.active = true
        """
        return (query, [parameter_item_ids])

    def get_parameters_with_document_parameter(self) -> tuple[str, list[Any]]:
        """Get all active parameters where document_parameter = true."""
        query = """
        SELECT id, name, description, document_parameter
        FROM parameters
        WHERE active = true AND document_parameter = true
        """
        return (query, [])

    def get_parameter_items_for_documents(self, document_ids: list[str]) -> tuple[str, list[Any]]:
        """Get parameter items that match given documents via document_parameter_items junction."""
        query = """
        SELECT DISTINCT pi.id, pi.name, pi.description, pi.value, pi.parameter_id
        FROM parameter_items pi
        JOIN document_parameter_items dpi ON dpi.parameter_item_id = pi.id
        WHERE dpi.document_id = ANY($1::uuid[])
          AND dpi.active = true
        """
        return (query, [document_ids])

    def get_parameter_items_for_document_parameter_params(
        self, parameter_ids: list[str]
    ) -> tuple[str, list[Any]]:
        """Get parameter items for parameters with document_parameter=true."""
        query = """
        SELECT pi.id, pi.name, pi.description, pi.value, pi.parameter_id
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE p.id = ANY($1::uuid[])
          AND p.document_parameter = true
          AND p.active = true
        """
        return (query, [parameter_ids])

    def get_randomization_data_complete(
        self, department_ids: list[str] | None = None
    ) -> tuple[str, list[Any]]:
        """Get all data needed for randomization in a single query.
        
        Returns personas, documents, parameters, parameter_items, and junction data
        all filtered by department_ids if provided, using JSONB aggregations.
        Avoids cartesian products by aggregating each entity type separately.
        """
        if department_ids and len(department_ids) > 0:
            # Convert string UUIDs to UUID objects for asyncpg
            import uuid
            department_uuids = [uuid.UUID(d) for d in department_ids]
            query = """
            WITH filtered_personas AS (
                SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
                FROM personas p
                LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
                WHERE p.active = true
                GROUP BY p.id, p.name, p.description
                HAVING 
                    COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($1::uuid[])) > 0
                    OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
            ),
            filtered_documents AS (
                SELECT DISTINCT d.id, d.name, d.type, d.file_path
                FROM documents d
                LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
                WHERE d.active = true
                GROUP BY d.id, d.name, d.type, d.file_path
                HAVING 
                    COUNT(dd.document_id) FILTER (WHERE dd.department_id = ANY($1::uuid[])) > 0
                    OR NOT EXISTS (SELECT 1 FROM document_departments dd2 WHERE dd2.document_id = d.id AND dd2.active = true)
            ),
            filtered_parameters AS (
                SELECT DISTINCT p.id, p.name, p.description, p.document_parameter
                FROM parameters p
                JOIN parameter_items pi ON pi.parameter_id = p.id
                LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
                WHERE p.active = true
                GROUP BY p.id, p.name, p.description, p.document_parameter
                HAVING 
                    COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
                    OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                                  JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                                  WHERE pi2.parameter_id = p.id AND pid2.active = true)
            ),
            parameter_items_data AS (
                SELECT DISTINCT pi.id, pi.name, pi.description, pi.value, pi.parameter_id
                FROM parameter_items pi
                JOIN filtered_parameters fp ON fp.id = pi.parameter_id
                LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
                GROUP BY pi.id, pi.name, pi.description, pi.value, pi.parameter_id
                HAVING 
                    COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($1::uuid[])) > 0
                    OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
            ),
            document_parameter_items_junction AS (
                SELECT DISTINCT dpi.document_id, dpi.parameter_item_id
                FROM document_parameter_items dpi
                JOIN filtered_documents fd ON fd.id = dpi.document_id
                JOIN parameter_items_data pid ON pid.id = dpi.parameter_item_id
                WHERE dpi.active = true
            )
            SELECT 
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', fp.id,
                        'name', fp.name,
                        'description', fp.description
                    )),
                    '[]'::json
                ) FROM filtered_personas fp) as personas,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', fd.id,
                        'name', fd.name,
                        'type', fd.type,
                        'file_path', fd.file_path
                    )),
                    '[]'::json
                ) FROM filtered_documents fd) as documents,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', fp2.id,
                        'name', fp2.name,
                        'description', fp2.description,
                        'document_parameter', fp2.document_parameter
                    )),
                    '[]'::json
                ) FROM filtered_parameters fp2) as parameters,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', pid.id,
                        'name', pid.name,
                        'description', pid.description,
                        'value', pid.value,
                        'parameter_id', pid.parameter_id
                    )),
                    '[]'::json
                ) FROM parameter_items_data pid) as parameter_items,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'document_id', dpi.document_id,
                        'parameter_item_id', dpi.parameter_item_id
                    )),
                    '[]'::json
                ) FROM document_parameter_items_junction dpi) as document_parameter_items
            """
            return (query, [department_uuids])
        else:
            query = """
            WITH all_personas AS (
                SELECT id, name, COALESCE(description, '') as description
                FROM personas
                WHERE active = true
            ),
            all_documents AS (
                SELECT id, name, type, file_path
                FROM documents
                WHERE active = true
            ),
            all_parameters AS (
                SELECT DISTINCT p.id, p.name, p.description, p.document_parameter
                FROM parameters p
                WHERE p.active = true
            ),
            all_parameter_items AS (
                SELECT pi.id, pi.name, pi.description, pi.value, pi.parameter_id
                FROM parameter_items pi
                JOIN all_parameters ap ON ap.id = pi.parameter_id
            ),
            all_document_parameter_items AS (
                SELECT DISTINCT dpi.document_id, dpi.parameter_item_id
                FROM document_parameter_items dpi
                JOIN all_documents ad ON ad.id = dpi.document_id
                JOIN all_parameter_items api ON api.id = dpi.parameter_item_id
                WHERE dpi.active = true
            )
            SELECT 
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', ap.id,
                        'name', ap.name,
                        'description', ap.description
                    )),
                    '[]'::json
                ) FROM all_personas ap) as personas,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', ad.id,
                        'name', ad.name,
                        'type', ad.type,
                        'file_path', ad.file_path
                    )),
                    '[]'::json
                ) FROM all_documents ad) as documents,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', ap2.id,
                        'name', ap2.name,
                        'description', ap2.description,
                        'document_parameter', ap2.document_parameter
                    )),
                    '[]'::json
                ) FROM all_parameters ap2) as parameters,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', api.id,
                        'name', api.name,
                        'description', api.description,
                        'value', api.value,
                        'parameter_id', api.parameter_id
                    )),
                    '[]'::json
                ) FROM all_parameter_items api) as parameter_items,
                (SELECT COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'document_id', adpi.document_id,
                        'parameter_item_id', adpi.parameter_item_id
                    )),
                    '[]'::json
                ) FROM all_document_parameter_items adpi) as document_parameter_items
            """
            return (query, [])

    def get_scenario_objectives_top_n(self, scenario_id: str, limit: int) -> tuple[str, list[Any]]:
        """Get top N objectives for scenario ordered by idx."""
        query = """
        SELECT idx, objective
        FROM scenario_objectives
        WHERE scenario_id = $1
        ORDER BY idx ASC
        LIMIT $2
        """
        return (query, [scenario_id, limit])

    def get_scenario_problem_statement_active(self, scenario_id: str) -> tuple[str, list[Any]]:
        """Get most recent active problem statement for scenario."""
        query = """
        SELECT problem_statement
        FROM scenario_problem_statements
        WHERE scenario_id = $1 AND active = true
        ORDER BY created_at DESC, updated_at DESC
        LIMIT 1
        """
        return (query, [scenario_id])

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
            s.generated,
            s.created_at,
            s.updated_at,
            s.use_documents,
            COALESCE(ARRAY_AGG(DISTINCT sd.document_id) FILTER (WHERE sd.document_id IS NOT NULL), ARRAY[]::uuid[]) as document_ids,
            COALESCE(ARRAY_AGG(DISTINCT spi.parameter_item_id) FILTER (WHERE spi.parameter_item_id IS NOT NULL), ARRAY[]::uuid[]) as parameter_item_ids,
            COALESCE((
                SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id)
                FROM scenario_personas 
                WHERE scenario_id = s.id AND active = true
            ), ARRAY[]::text[]) as persona_ids
        FROM scenarios s
        LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
        LEFT JOIN scenario_documents sd ON sd.scenario_id = s.id
        LEFT JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
        WHERE s.id = $1
        GROUP BY s.id, s.name, sps.problem_statement, s.active, 
                 s.generated, s.created_at, s.updated_at, s.use_documents
        """
        return (query, [scenario_id])

