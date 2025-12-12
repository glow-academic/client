WITH model_run_costs AS (
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
    WHERE ad.department_id = $1::uuid AND mr.agent_id IS NOT NULL
),
model_run_departments_via_personas AS (
    SELECT DISTINCT
        mrc.run_id,
        pd.department_id
    FROM model_run_costs mrc
    JOIN run_personas mrp ON mrp.run_id = mrc.run_id AND mrp.active = true
    JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
    WHERE pd.department_id = $1::uuid
),
model_run_departments AS (
    SELECT run_id, department_id::uuid as department_id FROM model_run_departments_via_agents
    UNION
    SELECT run_id, department_id::uuid as department_id FROM model_run_departments_via_personas
),
department_price_spent AS (
    SELECT 
        mrd.department_id::uuid as department_id,
        SUM(mrc.cost) as total_price_spent
    FROM model_run_costs mrc
    JOIN model_run_departments mrd ON mrd.run_id = mrc.run_id
    GROUP BY mrd.department_id
),
department_staff_count AS (
    SELECT 
        department_id::uuid as department_id, 
        COUNT(DISTINCT profile_id) as staff_count
    FROM profile_departments
    WHERE department_id = $1::uuid AND active = true
    GROUP BY department_id
),
department_usage AS (
    SELECT
        (SELECT COUNT(*) FROM profile_departments WHERE department_id = $1::uuid AND active = true) +
        (SELECT COUNT(*) FROM simulation_departments WHERE department_id = $1::uuid AND active = true) +
        (SELECT COUNT(*) FROM scenario_departments WHERE department_id = $1::uuid AND active = true) +
        (SELECT COUNT(*) FROM persona_departments WHERE department_id = $1::uuid AND active = true) +
        (SELECT COUNT(*) FROM document_departments WHERE department_id = $1::uuid AND active = true) +
        (SELECT COUNT(*) FROM cohort_departments WHERE department_id = $1::uuid AND active = true) as total_usage
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $2::uuid
),
user_department_access AS (
    -- Check if user has access to this department
    SELECT EXISTS(
        SELECT 1 FROM profile_departments pd
        WHERE pd.profile_id = $2::uuid AND pd.department_id = $1::uuid AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM profiles p WHERE p.id = $2::uuid AND p.role = 'superadmin'
    ) as has_access
),
profile_active_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as active_cohort_count
    FROM cohort_profiles
    WHERE active = true
    GROUP BY profile_id
),
profile_all_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as total_cohort_links
    FROM cohort_profiles
    GROUP BY profile_id
),
profile_cohorts AS (
    SELECT 
        cp.profile_id,
        ARRAY_AGG(cp.cohort_id::text ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
profile_departments_agg AS (
    SELECT 
        pd.profile_id,
        ARRAY_AGG(pd.department_id::text ORDER BY d.title) as department_ids
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
profile_primary_department AS (
    SELECT 
        pd.profile_id,
        pd.department_id
    FROM profile_departments pd
    WHERE pd.active = true AND pd.is_primary = true
),
recent_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as run_count
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY mrp.profile_id
),
profile_total_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as total_requests
    FROM run_profiles mrp
    GROUP BY mrp.profile_id
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids)::uuid as cohort_id
    FROM profile_cohorts
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM profile_departments_agg
),
cohort_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        c.id::text,
        jsonb_build_object(
            'name', c.title,
            'description', COALESCE(c.description, '')
        )
    ), '{}'::jsonb) as cohort_mapping
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
department_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object(
            'name', d.title,
            'description', COALESCE(d.description, '')
        )
    ), '{}'::jsonb) as department_mapping
    FROM departments d
    WHERE (d.id = $1::uuid OR d.id = ANY(ARRAY(SELECT department_id::uuid FROM all_department_ids)))
    AND d.active = true
),
department_models AS (
    -- Get all models available to this department (default + department-specific)
    SELECT DISTINCT
        m.id::text as model_id,
        m.name,
        COALESCE(m.description, '') as description,
        m.active
    FROM models m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE m.active = true
    AND (
        md.department_id = $1::uuid
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    )
    ORDER BY m.name
),
department_keys AS (
    -- Get all API keys available to this department via settings
    SELECT DISTINCT k.id::text as key_id, k.name, k.key, k.active
    FROM keys k
    JOIN setting_provider_keys spk ON spk.key_id = k.id AND spk.active = true
    JOIN settings s ON s.id = spk.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE k.active = true
    AND ds.department_id = $1::uuid
    AND ds.active = true
    UNION
    -- Also include all active keys (for backward compatibility and general access)
    SELECT DISTINCT k.id::text as key_id, k.name, k.key, k.active
    FROM keys k
    WHERE k.active = true
),
model_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            dm.model_id,
            jsonb_build_object(
                'name', dm.name,
                'description', dm.description
            )
        ),
        '{}'::jsonb
    ) as model_mapping,
    array_agg(dm.model_id ORDER BY dm.name) as model_ids
    FROM department_models dm
),
key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            dk.key_id,
            jsonb_build_object(
                'name', dk.name,
                'description', CASE 
                    WHEN LENGTH(dk.key) > 4 THEN LEFT(dk.key, 4) || '****'
                    ELSE '****'
                END,
                'key_masked', CASE 
                    WHEN LENGTH(dk.key) > 4 THEN LEFT(dk.key, 4) || '****'
                    ELSE '****'
                END,
                'active', dk.active
            )
        ) FILTER (WHERE dk.key_id IS NOT NULL),
        '{}'::jsonb
    ) as key_mapping,
    array_agg(dk.key_id ORDER BY dk.name) as key_ids
    FROM department_keys dk
),
model_key_associations AS (
    -- Get model-key associations for this department via settings
    SELECT 
        m.id::text as model_id,
        -- Get key from setting_provider_keys for this department's settings and model's provider
        (SELECT spk.key_id::text
         FROM setting_provider_keys spk
         JOIN settings s ON s.id = spk.settings_id AND s.active = true
         JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
         WHERE spk.provider_id = m.provider_id
         AND ds.department_id = $1::uuid
         AND ds.active = true
         AND spk.active = true
         LIMIT 1) as key_id
    FROM models m
    WHERE m.active = true
    AND (
        EXISTS (SELECT 1 FROM model_departments md WHERE md.model_id = m.id AND md.department_id = $1::uuid AND md.active = true)
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    )
),
model_key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            mka.model_id,
            mka.key_id
        ) FILTER (WHERE mka.key_id IS NOT NULL),
        '{}'::jsonb
    ) as model_key_mapping
    FROM model_key_associations mka
),
department_current_settings AS (
    -- Get current settings_id for this department (department-specific first, then default)
    SELECT COALESCE(
        -- Department-specific settings for this department
        (SELECT ds.settings_id::text
         FROM department_settings ds
         WHERE ds.department_id = $1::uuid AND ds.active = true
         LIMIT 1),
        -- Fallback to default settings (no department links)
        (SELECT s.id::text
         FROM settings s
         WHERE s.active = true
         AND NOT EXISTS (
             SELECT 1 FROM department_settings ds2 
             WHERE ds2.settings_id = s.id 
             AND ds2.active = true
         )
         ORDER BY s.created_at DESC
         LIMIT 1)
    ) as settings_id
),
all_settings_ids AS (
    -- Get all settings IDs for mapping
    SELECT DISTINCT s.id::text as settings_id
    FROM settings s
    WHERE s.active = true
),
settings_departments_data AS (
    -- Get department_ids for each setting
    SELECT 
        ds.settings_id,
        ARRAY_AGG(ds.department_id::text ORDER BY ds.created_at) as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
),
settings_mapping_data AS (
    -- Only return department-specific settings for this department + default settings
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'settings_id', s.id::text,
                'created_at', s.created_at::text,
                'active', s.active,
                'department_ids', COALESCE(sdd.department_ids, NULL)
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as settings_mapping
    FROM settings s
    LEFT JOIN settings_departments_data sdd ON sdd.settings_id::text = s.id::text
    WHERE s.active = true
    AND (
        -- Include department-specific settings for this department
        EXISTS (
            SELECT 1 FROM department_settings ds 
            WHERE ds.settings_id = s.id 
            AND ds.department_id = $1::uuid 
            AND ds.active = true
        )
        OR
        -- Include default settings (no department links)
        NOT EXISTS (
            SELECT 1 FROM department_settings ds2 
            WHERE ds2.settings_id = s.id 
            AND ds2.active = true
        )
    )
)
SELECT 
    d.id::text as department_id,
    d.title,
    d.description,
    d.active,
    COALESCE(dps.total_price_spent, 0) as total_price_spent,
    COALESCE(dsc.staff_count, 0) as staff_count,
    CASE WHEN du.total_usage > 0 THEN true ELSE false END as in_use,
    CASE 
        WHEN up.role = 'superadmin' THEN true
        WHEN up.role = 'admin' AND uda.has_access THEN true
        ELSE false
    END as can_edit,
    CASE WHEN up.role = 'superadmin' THEN true ELSE false END as can_duplicate,
    CASE 
        WHEN up.role = 'superadmin' AND du.total_usage = 0 THEN true
        ELSE false
    END as can_delete,
    dcs.settings_id,
    COALESCE(smd.settings_mapping, '{}'::jsonb) as settings_mapping,
    cmd.cohort_mapping,
    dmd.department_mapping,
    COALESCE(mmd.model_mapping, '{}'::jsonb) as model_mapping,
    COALESCE(mmd.model_ids, ARRAY[]::text[]) as valid_model_ids,
    COALESCE(kmd.key_mapping, '{}'::jsonb) as key_mapping,
    COALESCE(kmd.key_ids, ARRAY[]::text[]) as valid_key_ids,
    COALESCE(mkmd.model_key_mapping, '{}'::jsonb) as model_key_mapping
FROM departments d
LEFT JOIN department_price_spent dps ON dps.department_id = d.id
LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
CROSS JOIN department_usage du
CROSS JOIN user_profile up
CROSS JOIN user_department_access uda
CROSS JOIN cohort_mapping_data cmd
CROSS JOIN department_mapping_data dmd
CROSS JOIN model_mapping_data mmd
CROSS JOIN key_mapping_data kmd
CROSS JOIN model_key_mapping_data mkmd
LEFT JOIN department_current_settings dcs ON true
CROSS JOIN settings_mapping_data smd
WHERE d.id = $1::uuid
AND uda.has_access = true

