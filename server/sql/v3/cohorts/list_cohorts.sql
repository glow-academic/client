WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
cohort_profiles_agg AS (
    SELECT 
        cp.cohort_id,
        ARRAY_AGG(cp.profile_id ORDER BY p.last_name, p.first_name) as profile_ids
    FROM cohort_profiles cp
    JOIN profiles p ON p.id = cp.profile_id
    WHERE cp.active = true
    GROUP BY cp.cohort_id
),
cohort_profiles_role_filtered AS (
    SELECT 
        cp.cohort_id,
        ARRAY_AGG(cp.profile_id) FILTER (
            WHERE 
                (up.role = 'superadmin') OR
                (up.role = 'admin' AND p.role IN ('admin', 'instructional', 'ta', 'guest')) OR
                (up.role = 'instructional' AND p.role IN ('instructional', 'ta', 'guest')) OR
                (up.role = 'ta' AND p.role IN ('ta', 'guest')) OR
                (up.role = 'guest' AND p.role = 'guest')
        ) as profile_ids
    FROM cohort_profiles cp
    JOIN profiles p ON p.id = cp.profile_id
    CROSS JOIN user_profile up
    WHERE cp.active = true
    GROUP BY cp.cohort_id
),
cohort_simulations_agg AS (
    SELECT 
        cs.cohort_id,
        ARRAY_AGG(cs.simulation_id ORDER BY s.title) as simulation_ids
    FROM cohort_simulations cs
    JOIN simulations s ON s.id = cs.simulation_id
    WHERE cs.active = true
    GROUP BY cs.cohort_id
),
cohort_usage AS (
    SELECT DISTINCT cp.cohort_id, COUNT(DISTINCT ap.attempt_id) as usage_count
    FROM cohort_profiles cp
    JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
    WHERE cp.active = true
    GROUP BY cp.cohort_id
),
cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_departments cd
    WHERE cd.active = true
    GROUP BY cd.cohort_id
),
user_in_cohort AS (
    SELECT cohort_id
    FROM cohort_profiles
    WHERE profile_id = $1 AND active = true
),
all_profile_ids AS (
    SELECT DISTINCT unnest(profile_ids) as profile_id
    FROM cohort_profiles_agg
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM cohort_simulations_agg
),
simulation_scenarios_agg AS (
    SELECT 
        ss.simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY sc.name) as scenario_ids
    FROM simulation_scenarios ss
    JOIN scenarios sc ON sc.id = ss.scenario_id
    WHERE ss.simulation_id IN (SELECT simulation_id FROM all_simulation_ids)
      AND ss.active = true
    GROUP BY ss.simulation_id
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_scenarios_agg
),
scenario_personas_agg AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas sp
    WHERE sp.scenario_id IN (SELECT scenario_id FROM all_scenario_ids)
      AND sp.active = true
    GROUP BY sp.scenario_id
),
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM scenario_personas_agg
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
    FROM all_persona_ids api
    LEFT JOIN personas p ON p.id = api.persona_id
    LEFT JOIN persona_text_agents pta ON pta.persona_id = p.id AND pta.active = true
    LEFT JOIN agents a ON a.id = pta.agent_id
    LEFT JOIN models m ON m.id = a.model_id
    LEFT JOIN image_model_check imc ON imc.model_id = m.id
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(ps.problem_statement, ''),
                'active', s.active,
                'persona_ids', COALESCE(spa.persona_ids, ARRAY[]::text[]),
                'persona_mapping', pm.mapping
            )
        ) FILTER (WHERE s.id IS NOT NULL AND st.parent_id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
    -- Only include root scenarios (parent_id = child_id in scenario_tree)
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    CROSS JOIN persona_mapping_data pm
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM cohort_departments_data
    WHERE department_ids IS NOT NULL
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
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
        OR d.id IN (SELECT department_id FROM user_departments)
)
SELECT 
    c.id as cohort_id,
    c.title as name,
    c.description,
    c.active,
    COALESCE(cdd.department_ids, NULL) as department_ids,
    COALESCE(cp.profile_ids, ARRAY[]::uuid[]) as profile_ids,
    COALESCE(cs.simulation_ids, ARRAY[]::uuid[]) as simulation_ids,
    COALESCE(cu.usage_count, 0) as usage_count,
    COALESCE(array_length(cprf.profile_ids, 1), 0) as num_members,
    CASE 
        WHEN COALESCE(cdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        -- Can't delete if can't edit (stricter than can_edit)
        WHEN COALESCE(cdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin', 'superadmin') AND COALESCE(cu.usage_count, 0) = 0 THEN true
        ELSE false
    END as can_delete,
    true as can_duplicate,
    CASE
        WHEN uic.cohort_id IS NOT NULL THEN true
        ELSE false
    END as can_leave,
    (
        SELECT COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.first_name || ' ' || p.last_name,
                'description', COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '')
            )
        ), '{}'::jsonb)
        FROM profiles p
        WHERE p.id IN (SELECT profile_id FROM all_profile_ids)
    ) as profile_mapping,
    (
        SELECT COALESCE(jsonb_object_agg(
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
                    WHEN sdd.department_ids IS NOT NULL THEN to_jsonb(sdd.department_ids)
                    ELSE NULL::jsonb
                END,
                'scenario_ids', COALESCE(ssa.scenario_ids, ARRAY[]::uuid[])
            )
        ), '{}'::jsonb)
        FROM simulations s
        LEFT JOIN (
            SELECT 
                sd.simulation_id,
                ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
            FROM simulation_departments sd
            WHERE sd.active = true
            GROUP BY sd.simulation_id
        ) sdd ON sdd.simulation_id = s.id
        LEFT JOIN simulation_scenarios_agg ssa ON ssa.simulation_id = s.id
        WHERE s.id IN (SELECT simulation_id FROM all_simulation_ids)
    ) as simulation_mapping,
    sm.mapping as scenario_mapping,
    dmd.mapping as department_mapping
FROM cohorts c
LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
LEFT JOIN cohort_profiles_agg cp ON cp.cohort_id = c.id
LEFT JOIN cohort_profiles_role_filtered cprf ON cprf.cohort_id = c.id
LEFT JOIN cohort_simulations_agg cs ON cs.cohort_id = c.id
LEFT JOIN cohort_usage cu ON cu.cohort_id = c.id
LEFT JOIN user_in_cohort uic ON uic.cohort_id = c.id
CROSS JOIN user_profile up
CROSS JOIN department_mapping_data dmd
CROSS JOIN scenario_mapping_data sm
WHERE (
        (up.role = 'instructional' AND uic.cohort_id IS NOT NULL)
        OR
        up.role != 'instructional'
    )
GROUP BY c.id, c.title, c.description, c.active, 
         cdd.department_ids, cp.profile_ids, cprf.profile_ids, cs.simulation_ids, cu.usage_count, up.role, uic.cohort_id, dmd.mapping, sm.mapping
HAVING 
    COUNT(cd.cohort_id) FILTER (WHERE cd.department_id IN (SELECT department_id FROM user_departments)) > 0
    OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
ORDER BY c.title

