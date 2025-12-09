WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT rpi.resolved_profile_id, pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
parameter_active_scenario_links AS (
    SELECT 
        fp.parameter_id,
        COUNT(DISTINCT sf.scenario_id) as active_scenario_count
    FROM parameter_fields fp
    JOIN scenario_fields sf ON sf.field_id = fp.field_id
    WHERE fp.active = true AND sf.active = true
    GROUP BY fp.parameter_id
),
parameter_all_scenario_links AS (
    SELECT 
        fp.parameter_id,
        COUNT(DISTINCT sf.scenario_id) as total_scenario_links
    FROM parameter_fields fp
    JOIN scenario_fields sf ON sf.field_id = fp.field_id
    WHERE fp.active = true
    GROUP BY fp.parameter_id
),
scenario_parameters_data AS (
    SELECT 
        sp.parameter_id,
        ARRAY_AGG(DISTINCT st.parent_id::text ORDER BY st.parent_id::text) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM scenario_parameters sp
    JOIN scenarios s ON s.id = sp.scenario_id
    JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = st.child_id
    WHERE sp.active = true AND s.active = true
    GROUP BY sp.parameter_id
),
parameter_scenarios AS (
    -- Legacy CTE name for compatibility, uses new scenario_parameters table
    SELECT * FROM scenario_parameters_data
),
parameter_item_counts AS (
    SELECT 
        fp.parameter_id,
        COUNT(*) as num_items
    FROM parameter_fields fp
    WHERE fp.active = true
    GROUP BY fp.parameter_id
),
parameter_sample_items AS (
    SELECT 
        fp_sub.parameter_id,
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', fp_sub.field_id::text,
                'name', fp_sub.name,
                'description', fp_sub.description
            ) ORDER BY fp_sub.name
        ) as sample_items
    FROM (
        SELECT f.id as field_id, fp.parameter_id, f.name, f.description,
               ROW_NUMBER() OVER (PARTITION BY fp.parameter_id ORDER BY f.name) as rn
        FROM parameter_fields fp
        JOIN fields f ON f.id = fp.field_id
        WHERE fp.active = true
    ) fp_sub
    WHERE fp_sub.rn <= 3
    GROUP BY fp_sub.parameter_id
),
parameter_item_departments_data AS (
    -- Aggregate department IDs from both parameter-level and field-level departments
    SELECT 
        combined.parameter_id,
        ARRAY_AGG(DISTINCT combined.department_id::text ORDER BY combined.department_id::text) as department_ids
    FROM (
        -- Parameter-level departments
        SELECT pd.parameter_id, pd.department_id
        FROM parameter_departments pd
        WHERE pd.active = true
        UNION
        -- Field-level departments (for backward compatibility)
        SELECT fp.parameter_id, fd.department_id
        FROM parameter_fields fp
        JOIN field_departments fd ON fd.field_id = fp.field_id
        WHERE fp.active = true AND fd.active = true
    ) combined
    GROUP BY combined.parameter_id
),
parameter_item_departments_for_filter AS (
    SELECT DISTINCT
        combined.parameter_id,
        combined.department_id
    FROM (
        -- Parameter-level departments
        SELECT pd.parameter_id, pd.department_id
        FROM parameter_departments pd
        WHERE pd.active = true
        UNION
        -- Field-level departments (for backward compatibility)
        SELECT fp.parameter_id, fd.department_id
        FROM parameter_fields fp
        JOIN field_departments fd ON fd.field_id = fp.field_id
        WHERE fp.active = true AND fd.active = true
    ) combined
),
parameter_documents AS (
    SELECT 
        fp.parameter_id,
        ARRAY_AGG(DISTINCT df.document_id::text ORDER BY df.document_id::text) as document_ids
    FROM parameter_fields fp
    JOIN document_fields df ON df.field_id = fp.field_id
    WHERE fp.active = true AND df.active = true
    GROUP BY fp.parameter_id
),
user_profile AS (
    SELECT p.role
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM parameter_item_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT ud.department_id FROM user_departments ud
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids)::uuid as scenario_id
    FROM parameter_scenarios
    WHERE scenario_ids IS NOT NULL
),
all_document_ids AS (
    SELECT DISTINCT unnest(document_ids)::uuid as document_id
    FROM parameter_documents
    WHERE document_ids IS NOT NULL
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(ps.problem_statement, ''),
                'active', s.active,
                'persona_id', NULL,
                'persona_mapping', '{}'::jsonb,
                'document_mapping', '{}'::jsonb,
                'field_mapping', '{}'::jsonb,
                'parameter_item_ids', ARRAY[]::text[],
                'document_ids', ARRAY[]::text[]
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
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
),
document_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            doc.id::text,
            jsonb_build_object(
                'name', doc.name,
                'description', ''
            )
        ) FILTER (WHERE doc.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM documents doc
    WHERE doc.id IN (SELECT document_id FROM all_document_ids)
)
SELECT 
    p.id as parameter_id,
    p.name,
    p.description,
    p.active,
    p.updated_at,
    COALESCE(pidd.department_ids, NULL) as department_ids,
    COALESCE(pic.num_items, 0) as num_items,
    COALESCE(spd.scenario_ids, ARRAY[]::text[]) as scenario_ids,
    COALESCE(pd.document_ids, ARRAY[]::text[]) as document_ids,
    COALESCE(pasl.active_scenario_count, 0) as active_scenario_count,
    COALESCE(pasl_all.total_scenario_links, 0) as total_scenario_links,
    COALESCE(psi.sample_items, '[]'::jsonb) as sample_items_json,
    sm.mapping as scenario_mapping,
    dmd.mapping as department_mapping,
    docmd.mapping as document_mapping,
    CASE 
        WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN COALESCE(pasl_all.total_scenario_links, 0) > 0 THEN false
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_duplicate
FROM parameters p
LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_id = p.id
LEFT JOIN parameter_item_counts pic ON pic.parameter_id = p.id
LEFT JOIN scenario_parameters_data spd ON spd.parameter_id = p.id
LEFT JOIN parameter_scenarios ps ON ps.parameter_id = p.id
LEFT JOIN parameter_documents pd ON pd.parameter_id = p.id
LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
LEFT JOIN parameter_all_scenario_links pasl_all ON pasl_all.parameter_id = p.id
LEFT JOIN parameter_sample_items psi ON psi.parameter_id = p.id
CROSS JOIN user_profile up
CROSS JOIN scenario_mapping_data sm
CROSS JOIN department_mapping_data dmd
CROSS JOIN document_mapping_data docmd
GROUP BY p.id, p.name, p.description,  p.active, p.updated_at, pidd.department_ids, pic.num_items, 
         ps.scenario_ids, spd.scenario_ids, pd.document_ids, pasl.active_scenario_count, pasl_all.total_scenario_links, psi.sample_items, up.role, sm.mapping, dmd.mapping, docmd.mapping
HAVING 
    -- Include if has matching department link via parameter_departments or field_departments OR has no department links at all (cross-dept)
    COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id IN (SELECT ud.department_id FROM user_departments ud)) > 0
    OR NOT EXISTS (
        SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
    )
    AND NOT EXISTS (
        SELECT 1 FROM field_departments fd2 
        JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
        WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true
    )
ORDER BY p.updated_at DESC NULLS LAST

