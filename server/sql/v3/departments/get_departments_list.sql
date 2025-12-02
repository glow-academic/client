WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
model_run_costs AS (
    SELECT 
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * mp.price
        ), 0) as cost
    FROM run_pricing_usage rpu
    JOIN run_models rm ON rm.run_id = rpu.run_id AND rm.active = true
    JOIN model_pricing mp ON mp.model_id = rm.model_id 
        AND mp.pricing_type = rpu.pricing_type 
        AND mp.unit_id = rpu.unit_id
        AND mp.active = true
    JOIN units u ON u.id = rpu.unit_id
    GROUP BY rpu.run_id
),
model_run_departments_via_agents AS (
    SELECT DISTINCT
        mrc.run_id,
        ad.department_id
    FROM model_run_costs mrc
    JOIN runs mr ON mr.id = mrc.run_id
    JOIN agent_departments ad ON ad.agent_id = mr.agent_id AND ad.active = true
    WHERE mr.agent_id IS NOT NULL
    AND ad.department_id IN (SELECT department_id FROM user_departments)
),
model_run_departments_via_personas AS (
    SELECT DISTINCT
        mrc.run_id,
        pd.department_id
    FROM model_run_costs mrc
    JOIN run_personas mrp ON mrp.run_id = mrc.run_id AND mrp.active = true
    JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
),
model_run_departments_via_profiles AS (
    SELECT DISTINCT
        mrc.run_id,
        pd.department_id
    FROM model_run_costs mrc
    JOIN run_profiles mrp ON mrp.run_id = mrc.run_id AND mrp.active = true
    JOIN profile_departments pd ON pd.profile_id = mrp.profile_id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
),
model_run_departments AS (
    SELECT run_id, department_id FROM model_run_departments_via_agents
    UNION
    SELECT run_id, department_id FROM model_run_departments_via_personas
    UNION
    SELECT run_id, department_id FROM model_run_departments_via_profiles
),
department_price_spent AS (
    SELECT 
        mrd.department_id,
        SUM(mrc.cost) as total_price_spent
    FROM model_run_costs mrc
    JOIN model_run_departments mrd ON mrd.run_id = mrc.run_id
    GROUP BY mrd.department_id
),
department_staff_count AS (
    SELECT 
        department_id, 
        COUNT(DISTINCT profile_id) as staff_count
    FROM profile_departments
    WHERE department_id IN (SELECT department_id FROM user_departments)
    GROUP BY department_id
),
department_cohorts_data AS (
    SELECT 
        cd.department_id,
        ARRAY_AGG(cd.cohort_id::text ORDER BY cd.created_at) as cohort_ids
    FROM cohort_departments cd
    WHERE cd.department_id IN (SELECT department_id FROM user_departments) AND cd.active = true
    GROUP BY cd.department_id
),
department_profiles_data AS (
    SELECT 
        pd.department_id,
        ARRAY_AGG(pd.profile_id::text ORDER BY p.last_name, p.first_name) as profile_ids
    FROM profile_departments pd
    JOIN profiles p ON p.id = pd.profile_id
    WHERE pd.department_id IN (SELECT department_id FROM user_departments) AND pd.active = true
    GROUP BY pd.department_id
),
department_all_cohort_links AS (
    SELECT 
        cd.department_id,
        COUNT(*) as total_cohort_links
    FROM cohort_departments cd
    WHERE cd.department_id IN (SELECT department_id FROM user_departments) AND cd.active = true
    GROUP BY cd.department_id
),
department_profiles_would_orphan AS (
    SELECT 
        pd.department_id,
        COUNT(*) as profiles_with_only_this_dept
    FROM profile_departments pd
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND NOT EXISTS (
        SELECT 1 FROM profile_departments pd2 
        WHERE pd2.profile_id = pd.profile_id 
        AND pd2.department_id != pd.department_id
    )
    GROUP BY pd.department_id
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids)::uuid as cohort_id
    FROM department_cohorts_data
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
all_profile_ids AS (
    SELECT DISTINCT unnest(profile_ids)::uuid as profile_id
    FROM department_profiles_data
    WHERE profile_ids IS NOT NULL
),
profile_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.first_name || ' ' || p.last_name,
                'description', COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '')
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM profiles p
    WHERE p.id IN (SELECT profile_id FROM all_profile_ids)
)
SELECT 
    d.id::text as department_id,
    d.title,
    d.description,
    d.active,
    d.updated_at,
    COALESCE(dps.total_price_spent, 0) as total_price_spent,
    COALESCE(dsc.staff_count, 0) as staff_count,
    COALESCE(dcd.cohort_ids, ARRAY[]::text[]) as cohort_ids,
    COALESCE(dpd.profile_ids, ARRAY[]::text[]) as profile_ids,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN COALESCE(dacl_all.total_cohort_links, 0) > 0 THEN false
        WHEN COALESCE(dpwo.profiles_with_only_this_dept, 0) > 0 THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_duplicate,
    cmd.mapping as cohort_mapping,
    pmd.mapping as profile_mapping
FROM departments d
JOIN user_departments ud ON ud.department_id = d.id
LEFT JOIN department_price_spent dps ON dps.department_id = d.id
LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
LEFT JOIN department_cohorts_data dcd ON dcd.department_id = d.id
LEFT JOIN department_profiles_data dpd ON dpd.department_id = d.id
LEFT JOIN department_all_cohort_links dacl_all ON dacl_all.department_id = d.id
LEFT JOIN department_profiles_would_orphan dpwo ON dpwo.department_id = d.id
CROSS JOIN user_profile up
CROSS JOIN cohort_mapping_data cmd
CROSS JOIN profile_mapping_data pmd
ORDER BY d.title

