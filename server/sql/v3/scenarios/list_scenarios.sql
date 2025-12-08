WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
scenario_objectives AS (
    SELECT 
        so.scenario_id,
        ARRAY_AGG(o.id::text ORDER BY so.idx) as objective_ids
    FROM scenario_objectives so
    JOIN objectives o ON o.id = so.objective_id
    GROUP BY so.scenario_id
),
scenario_parameters AS (
    SELECT 
        sf.scenario_id,
        ARRAY_AGG(DISTINCT sf.field_id) as parameter_item_ids
    FROM scenario_fields sf
    WHERE sf.active = true
    GROUP BY sf.scenario_id
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
scenario_attributes AS (
    SELECT DISTINCT ON (ss.scenario_id)
        ss.scenario_id,
        ss.hints_enabled,
        s.objectives_enabled,
        s.image_enabled as image_input_enabled
    FROM simulation_scenarios ss
    JOIN scenarios s ON s.id = ss.scenario_id
    WHERE ss.active = true
    ORDER BY ss.scenario_id, ss.position
),
scenario_data AS (
    SELECT 
        s.id as scenario_id,
        s.name as title,
        COALESCE(ps.problem_statement, '') as problem_statement,
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
        COALESCE(sa.hints_enabled, false) as hints_enabled,
        COALESCE(sa.objectives_enabled, true) as objectives_enabled,
        COALESCE(sa.image_input_enabled, false) as image_input_enabled,
        CASE WHEN COUNT(sd.scenario_id) > 0 THEN true ELSE false END as has_dept_links,
        CASE 
            WHEN COALESCE(sdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(ss.num_simulations, 0) = 0 
            THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit (stricter than can_edit)
            WHEN COALESCE(sdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
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
    LEFT JOIN scenario_problem_statements sps_j ON sps_j.scenario_id = s.id AND sps_j.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps_j.problem_statement_id
    LEFT JOIN scenario_objectives so ON so.scenario_id = s.id
    LEFT JOIN scenario_parameters spar ON spar.scenario_id = s.id
    LEFT JOIN scenario_simulations ss ON ss.scenario_id = s.id
    LEFT JOIN scenario_all_simulation_links sal ON sal.scenario_id = s.id
    LEFT JOIN scenario_cohorts sc ON sc.scenario_id = s.id
    LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
    LEFT JOIN scenario_attributes sa ON sa.scenario_id = s.id
    CROSS JOIN user_profile up
    GROUP BY s.id, s.name, ps.problem_statement, s.active, s.generated, s.updated_at, st.parent_id, 
             so.objective_ids, spa.persona_ids, spar.parameter_item_ids, ss.simulation_ids, ss.num_simulations, 
             sc.cohort_ids, sdd.department_ids, sal.total_links, up.role,
             sa.hints_enabled, sa.objectives_enabled, sa.image_input_enabled
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
            f.id::text,
            jsonb_build_object(
                'name', f.name,
                'description', COALESCE(f.description, ''),
                'parameter_id', fp.parameter_id::text,
                'parameter_name', p.name,
                'value', COALESCE(f.value, '')
            )
        ) FILTER (WHERE f.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    WHERE f.id IN (SELECT parameter_item_id FROM all_parameter_item_ids)
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
image_model_check AS (
    SELECT 
        model_id,
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE modality = 'image' AND is_input = false AND active = true
    GROUP BY model_id
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
                'image_model', COALESCE(imc.image_model, false)
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM personas p
    LEFT JOIN persona_text_agents pta ON pta.persona_id = p.id AND pta.active = true
    LEFT JOIN agents a ON a.id = pta.agent_id
    LEFT JOIN models m ON m.id = a.model_id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
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
                'time_limit', COALESCE(
                    (SELECT SUM(stl.time_limit_seconds)
                     FROM scenario_time_limits stl
                     JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                     WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                    0
                ),
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

