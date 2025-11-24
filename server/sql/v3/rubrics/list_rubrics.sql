WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
rubric_active_simulation_links AS (
    SELECT 
        rubric_id,
        COUNT(*) as active_simulation_count
    FROM simulations
    WHERE active = true
    GROUP BY rubric_id
),
rubric_all_simulation_links AS (
    SELECT 
        rubric_id,
        COUNT(*) as total_simulation_links
    FROM simulations
    GROUP BY rubric_id
),
simulation_department_access_for_rubrics AS (
    -- Pre-compute which simulations the user has access to (for filtering rubric_simulations_data)
    SELECT 
        s.id as simulation_id,
        CASE 
            -- Include if has matching department link OR has no department links at all (cross-dept)
            WHEN COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT department_id FROM user_departments)) > 0 THEN true
            WHEN NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true) THEN true
            ELSE false
        END as has_access
    FROM simulations s
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.active = true
    GROUP BY s.id
),
rubric_simulations_data AS (
    SELECT 
        (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id,
        ARRAY_AGG(s.id::text ORDER BY s.title) as simulation_ids
    FROM simulations s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    WHERE s.active = true
    GROUP BY (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1)
),
rubric_departments_data AS (
    SELECT 
        rd.rubric_id,
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments rd
    WHERE rd.active = true
    GROUP BY rd.rubric_id
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
rubric_data AS (
    SELECT 
        r.id as rubric_id,
        r.name,
        r.description,
        r.points,
        r.pass_points as passPoints,
        COALESCE(rdd.department_ids, NULL) as department_ids,
        COALESCE(rsd.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(rasl.active_simulation_count, 0) as active_simulation_count,
        COALESCE(rasl_all.total_simulation_links, 0) as total_simulation_links,
        CASE 
            WHEN COALESCE(rasl.active_simulation_count, 0) > 0 THEN false
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(rasl_all.total_simulation_links, 0) > 0 THEN false
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_duplicate
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    LEFT JOIN rubric_departments_data rdd ON rdd.rubric_id = r.id
    LEFT JOIN rubric_simulations_data rsd ON rsd.rubric_id = r.id
    LEFT JOIN rubric_active_simulation_links rasl ON rasl.rubric_id = r.id
    LEFT JOIN rubric_all_simulation_links rasl_all ON rasl_all.rubric_id = r.id
    CROSS JOIN user_profile up
    GROUP BY r.id, r.name, r.description, r.points, r.pass_points, rdd.department_ids, rsd.simulation_ids, rasl.active_simulation_count, rasl_all.total_simulation_links, up.role
    HAVING 
        COUNT(rd.rubric_id) FILTER (WHERE rd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM rubric_data
),
rubric_groups_structure AS (
    SELECT 
        sg.rubric_id,
        jsonb_object_agg(
            sg.id::text,
            COALESCE(
                (SELECT jsonb_agg(s.id::text ORDER BY s.name)
                 FROM standards s
                 WHERE s.standard_group_id = sg.id),
                '[]'::jsonb
            )
        ) as groups_structure
    FROM standard_groups sg
    WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
    GROUP BY sg.rubric_id
),
standard_groups_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sg.id::text,
            jsonb_build_object(
                'name', sg.name,
                'description', COALESCE(sg.description, ''),
                'points', sg.points,
                'passPoints', sg.pass_points
            )
        ) FILTER (WHERE sg.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM standard_groups sg
    WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
),
standards_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(s.description, ''),
                'points', s.points
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM standards s
    WHERE s.standard_group_id IN (
        SELECT id FROM standard_groups WHERE rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
    )
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM rubric_departments_data
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
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids)::uuid as simulation_id
    FROM rubric_simulations_data
    WHERE simulation_ids IS NOT NULL
),
simulation_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.title,
                'description', COALESCE(s.description, '')
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM simulations s
    INNER JOIN simulation_department_access_for_rubrics sdar ON sdar.simulation_id = s.id AND sdar.has_access = true
    WHERE s.id IN (SELECT simulation_id FROM all_simulation_ids)
)
SELECT 
    rd.*,
    COALESCE(rgs.groups_structure, '{}'::jsonb) as standard_groups,
    sgm.mapping as standard_groups_mapping,
    sm.mapping as standards_mapping,
    dmd.mapping as department_mapping,
    simd.mapping as simulation_mapping
FROM rubric_data rd
LEFT JOIN rubric_groups_structure rgs ON rgs.rubric_id = rd.rubric_id
CROSS JOIN standard_groups_mapping_data sgm
CROSS JOIN standards_mapping_data sm
CROSS JOIN department_mapping_data dmd
CROSS JOIN simulation_mapping_data simd
ORDER BY rd.name

