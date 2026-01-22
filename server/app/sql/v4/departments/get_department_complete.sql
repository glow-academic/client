-- Unified get department function - handles both new (department_id = NULL) and detail (department_id provided)
-- Converted to function with composite types following personas pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_department_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_department_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_department_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_setting AS (
    settings_id uuid,
    created_at timestamptz,
    active boolean,
    department_ids uuid[],
    generated boolean
);

CREATE TYPE types.q_get_department_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_model AS (
    model_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_key AS (
    key_id uuid,
    name text,
    description text,
    key_masked text,
    active boolean,
    generated boolean
);

CREATE TYPE types.q_get_department_v4_model_key AS (
    model_id uuid,
    key_id uuid
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_department_v4(
    profile_id uuid,
    department_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    department_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_department_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_department_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_department_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_department_v4_description_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_department_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_department_v4_flag_resource[],
    -- Multi-select resources: settings
    settings_ids uuid[],
    settings_resources types.q_get_department_v4_setting[],
    show_settings boolean,
    settings_agent_id uuid,
    settings_required boolean,
    settings_suggestions uuid[],
    settings types.q_get_department_v4_setting[],
    -- Multi-select resources: cohorts
    cohort_ids uuid[],
    cohort_resources types.q_get_department_v4_cohort[],
    show_cohorts boolean,
    cohorts_agent_id uuid,
    cohorts_required boolean,
    cohort_suggestions uuid[],
    cohorts types.q_get_department_v4_cohort[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_department_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_department_v4_department[],
    -- Multi-select resources: models
    model_ids uuid[],
    model_resources types.q_get_department_v4_model[],
    show_models boolean,
    models_agent_id uuid,
    models_required boolean,
    model_suggestions uuid[],
    models types.q_get_department_v4_model[],
    -- Multi-select resources: keys
    key_ids uuid[],
    key_resources types.q_get_department_v4_key[],
    show_keys boolean,
    keys_agent_id uuid,
    keys_required boolean,
    key_suggestions uuid[],
    keys types.q_get_department_v4_key[],
    -- Additional fields from detail endpoint
    can_duplicate boolean,
    can_delete boolean,
    in_use boolean,
    staff_count int,
    total_price_spent float,
    settings_id uuid,
    valid_department_ids uuid[],
    valid_model_ids uuid[],
    valid_key_ids uuid[],
    model_keys types.q_get_department_v4_model_key[],
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check department existence if department_id provided
department_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT department_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM department_artifact WHERE id = (SELECT department_id FROM params))::boolean
        END as department_exists
),
-- Draft data
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN resource_drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN resource_drafts d ON d.id = x.draft_id
    -- Always return at least one row
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get department access only if department_id provided
user_department_access AS (
    SELECT 
        CASE 
            WHEN (SELECT department_id FROM params) IS NULL THEN true::boolean
            ELSE EXISTS(
                SELECT 1 FROM profile_departments pd
                WHERE pd.profile_id = (SELECT profile_id FROM params) 
                  AND pd.department_id = (SELECT department_id FROM params) 
                  AND pd.active = true
            ) OR EXISTS(
                SELECT 1 FROM profile_artifact p 
                WHERE p.id = (SELECT profile_id FROM params) 
                  AND EXISTS (
                      SELECT 1 FROM profile_roles pr_j 
                      JOIN roles_resource r ON pr_j.role_id = r.id 
                      WHERE pr_j.profile_id = p.id 
                      AND r.role = 'superadmin'::profile_role
                  )
            )
        END as has_access
),
-- Name resource data (from draft or department)
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM names_draft dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT dn.name_id FROM department_names dn WHERE dn.department_id = (SELECT department_id FROM params) LIMIT 1)
        ) as name_id,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_department_v4_name_resource 
         FROM names_draft dn 
         JOIN names_resource n ON dn.names_id = n.id 
         WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_name_resource,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_department_v4_name_resource 
         FROM department_names dn 
         JOIN names_resource n ON dn.name_id = n.id 
         WHERE dn.department_id = (SELECT department_id FROM params) LIMIT 1) as department_name_resource
    FROM params
),
-- Description resource data
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_draft dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT dd.description_id FROM department_descriptions dd WHERE dd.department_id = (SELECT department_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_department_v4_description_resource 
         FROM descriptions_draft dd 
         JOIN descriptions_resource d ON dd.descriptions_id = d.id 
         WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_department_v4_description_resource 
         FROM department_descriptions dd 
         JOIN descriptions_resource d ON dd.description_id = d.id 
         WHERE dd.department_id = (SELECT department_id FROM params) LIMIT 1) as department_description_resource
    FROM params
),
-- Flag resource data
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM flags_draft df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT df.flag_id FROM department_flags df 
             JOIN flags_resource fl ON df.flag_id = fl.id 
             WHERE df.department_id = (SELECT department_id FROM params) 
               AND fl.name = 'active' 
               AND df.value = true LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_department_v4_flag_resource 
         FROM flags_draft df 
         JOIN flags_resource f ON df.flags_id = f.id 
         WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_department_v4_flag_resource 
         FROM department_flags df 
         JOIN flags_resource f ON df.flag_id = f.id 
         WHERE df.department_id = (SELECT department_id FROM params) 
           AND f.name = 'department_active' 
           AND f.name = 'department_active' AND df.value = true LIMIT 1) as department_flag_resource
    FROM params
),
-- Name suggestions
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dn.name_id ORDER BY dn.created_at DESC)
             FROM (
                 SELECT DISTINCT dn.name_id, MAX(dn.created_at) as created_at
                 FROM department_names dn
                 JOIN names_resource n ON n.id = dn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE dn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to departments (validated by usage)
                       -- Option 2: OR linked to same group with generated=true
                       COALESCE(n.generated, false) = false
                       OR
                       (
                           COALESCE(n.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY dn.name_id
                 ORDER BY MAX(dn.created_at) DESC
                 LIMIT 20
             ) dn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
-- Names suggestions objects
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_department_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_department_v4_name_resource[]
        ) as names
    FROM params
    LIMIT 1
),
-- Description suggestions
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dd.description_id ORDER BY dd.created_at DESC)
             FROM (
                 SELECT DISTINCT dd.description_id, MAX(dd.created_at) as created_at
                 FROM department_descriptions dd
                 JOIN descriptions_resource d ON d.id = dd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE dd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       COALESCE(d.generated, false) = false
                       OR
                       (
                           COALESCE(d.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY dd.description_id
                 ORDER BY MAX(dd.created_at) DESC
                 LIMIT 20
             ) dd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
-- Descriptions suggestions objects
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_department_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_department_v4_description_resource[]
        ) as descriptions
    FROM params
    LIMIT 1
),
-- Flags data (all active flags)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    WHERE f.name = 'department_active'
),
-- Tool existence checks
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'settings'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as settings_has_tools
    FROM params x
),
-- UI flags
ui_flags AS (
    SELECT 
        true as show_name,
        true as show_description,
        true as show_flag,
        true as show_settings,
        true as show_cohorts,
        true as show_departments,
        true as show_models,
        true as show_keys
    FROM params x
),
-- Missing tools check
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.descriptions_has_tools THEN 'description' ELSE NULL END,
            CASE WHEN NOT tec.flags_has_tools THEN 'flag' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN tools_existence_check tec
),
-- Permissions data
permissions_data_with_tools AS (
    SELECT 
        CASE 
            WHEN (SELECT department_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (SELECT 1 FROM user_departments) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN up.role = 'admin' AND uda.has_access THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT department_id FROM params) IS NULL THEN
                -- New mode: compute disabled_reason based on missing tools
                CASE 
                    WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                        'No tool configured for ' || 
                        array_to_string(mtc.missing_resources, ', ') || 
                        '. Therefore we cannot proceed ahead.'::text
                    ELSE NULL::text
                END
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN NOT uda.has_access THEN 
                        'You don''t have access to this department. It may be restricted to other departments.'::text
                    WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                        'No tool configured for ' || 
                        array_to_string(mtc.missing_resources, ', ') || 
                        '. Therefore we cannot proceed ahead.'::text
                    ELSE NULL::text
                END
        END as base_disabled_reason
    FROM params x
    CROSS JOIN user_profile up
    CROSS JOIN user_department_access uda
    CROSS JOIN missing_tools_check mtc
),
permissions_final AS (
    SELECT 
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        pd.base_disabled_reason as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
),
-- Agent selection CTEs (simplified - can be enhanced later)
-- For now, return NULL for agent IDs (agents are optional)
name_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
description_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
flag_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
settings_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
cohorts_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
departments_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
models_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
keys_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
-- Settings data (from detail endpoint logic)
settings_departments_data AS (
    SELECT 
        ds.settings_id,
        CASE 
            WHEN COUNT(ds.department_id) > 0 THEN ARRAY_AGG(ds.department_id ORDER BY ds.created_at) FILTER (WHERE ds.department_id IS NOT NULL)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM department_settings ds
    WHERE ds.active = true
    GROUP BY ds.settings_id
),
settings_data AS (
    SELECT DISTINCT
        s.id as settings_id,
        s.created_at,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) as active,
        COALESCE(sdd.department_ids, ARRAY[]::uuid[]) as department_ids,
        false as generated  -- Settings are not AI-generated
    FROM setting_artifact s
    LEFT JOIN settings_departments_data sdd ON sdd.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
    AND (
        -- Include department-specific settings for this department (if detail mode)
        (SELECT department_id FROM params) IS NULL
        OR
        EXISTS (
            SELECT 1 FROM department_settings ds 
            WHERE ds.settings_id = s.id 
            AND ds.department_id = (SELECT department_id FROM params) 
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
),
-- Department current settings (for detail mode)
department_current_settings AS (
    SELECT COALESCE(
        -- Department-specific settings for this department
        (SELECT ds.settings_id
         FROM department_settings ds
         WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
         LIMIT 1),
        -- Fallback to default settings (no department links)
        (SELECT s.id
         FROM setting_artifact s
         WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
         AND NOT EXISTS (
             SELECT 1 FROM department_settings ds2 
             WHERE ds2.settings_id = s.id 
             AND ds2.active = true
         )
         ORDER BY s.created_at DESC
         LIMIT 1)
    ) as settings_id
    WHERE (SELECT department_id FROM params) IS NOT NULL
),
-- Settings IDs (selected settings for department)
settings_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT department_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ds.settings_id)
                 FROM department_settings ds
                 WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true),
                ARRAY[]::uuid[]
            )
        END as settings_ids
    FROM params
    LIMIT 1
),
-- Settings suggestions
settings_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(s.id ORDER BY s.created_at DESC)
             FROM setting_artifact s
             WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as settings_suggestions
    FROM params
    LIMIT 1
),
-- Cohorts data (from detail endpoint)
user_profile_cohorts AS (
    SELECT 
        ARRAY_AGG(cp.cohort_id ORDER BY (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
    FROM profile_cohorts cp
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE cp.profile_id = (SELECT profile_id FROM params) AND cp.active = true
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM user_profile_cohorts
    WHERE cohort_ids IS NOT NULL AND array_length(cohort_ids, 1) > 0
    UNION ALL
    SELECT NULL::uuid as cohort_id
    WHERE NOT EXISTS (
        SELECT 1 FROM user_profile_cohorts
        WHERE cohort_ids IS NOT NULL AND array_length(cohort_ids, 1) > 0
    )
),
cohorts_data AS (
    SELECT DISTINCT
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description,
        false as generated  -- Cohorts are not AI-generated
    FROM cohort_artifact c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
-- Cohort IDs (selected cohorts for department - from detail endpoint)
cohort_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT department_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cd.cohort_id ORDER BY cd.created_at)
                 FROM cohort_departments cd
                 WHERE cd.department_id = (SELECT department_id FROM params) AND cd.active = true),
                ARRAY[]::uuid[]
            )
        END as cohort_ids
    FROM params
    LIMIT 1
),
-- Cohort suggestions
cohort_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(c.id ORDER BY c.created_at DESC)
             FROM cohort_artifact c
             WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as cohort_suggestions
    FROM params
    LIMIT 1
),
-- Departments data (from detail endpoint)
user_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id ORDER BY (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1)) as department_ids
    FROM profile_departments pd
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT profile_id FROM params) AND pd.active = true
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM user_profile_departments
    WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
    UNION ALL
    SELECT NULL::uuid as department_id
    WHERE NOT EXISTS (
        SELECT 1 FROM user_profile_departments
        WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
    )
),
departments_data AS (
    SELECT DISTINCT
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        false as generated  -- Departments are not AI-generated
    FROM department_artifact d
    WHERE (d.id = (SELECT department_id FROM params) OR EXISTS (SELECT 1 FROM all_department_ids WHERE department_id = d.id))
    AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
),
-- Department IDs (selected departments - empty for departments, used for valid options)
department_ids_data AS (
    SELECT ARRAY[]::uuid[] as department_ids
    FROM params
    LIMIT 1
),
-- Department suggestions
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(d.id ORDER BY d.created_at DESC)
             FROM departments_resource d
             WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
             AND EXISTS (SELECT 1 FROM all_department_ids WHERE department_id = d.id)
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Models data (from detail endpoint)
department_settings_for_model_keys AS (
    SELECT DISTINCT ds.settings_id
    FROM department_settings ds
    WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true
),
department_models AS (
    SELECT DISTINCT
        m.id as model_id,
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), '') as description,
        false as generated  -- Models are not AI-generated
    FROM model_artifact m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'model_active' AND mf.value = true)
    AND (
        (SELECT department_id FROM params) IS NULL
        OR
        md.department_id = (SELECT department_id FROM params)
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    )
),
-- Model IDs (selected models - empty for departments, used for valid options)
model_ids_data AS (
    SELECT ARRAY[]::uuid[] as model_ids
    FROM params
    LIMIT 1
),
-- Model suggestions
model_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(m.id ORDER BY m.created_at DESC)
             FROM model_artifact m
             WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'model_active' AND mf.value = true)
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as model_suggestions
    FROM params
    LIMIT 1
),
-- Keys data (from detail endpoint)
keys_data AS (
    SELECT DISTINCT 
        kr.id as key_id, 
        kr.name as name, 
        CASE 
            WHEN LENGTH(kr.key) > 4 THEN LEFT(kr.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        CASE 
            WHEN LENGTH(kr.key) > 4 THEN LEFT(kr.key, 4) || '****'
            ELSE '****'
        END as description,
        kr.active as active,
        false as generated  -- Keys are not AI-generated
    FROM keys_resource kr
    WHERE kr.active
    AND (
        (SELECT department_id FROM params) IS NULL
        OR
        EXISTS (
            SELECT 1 FROM setting_provider_keys spk
            JOIN setting_artifact s ON s.id = spk.settings_id
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
            WHERE spk.key_id = kr.id AND spk.active = true
            AND ds.department_id = (SELECT department_id FROM params)
        )
    )
),
-- Key IDs (selected keys - empty for departments, used for valid options)
key_ids_data AS (
    SELECT ARRAY[]::uuid[] as key_ids
    FROM params
    LIMIT 1
),
-- Key suggestions
key_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(kr.id ORDER BY kr.created_at DESC)
             FROM keys_resource kr
             WHERE kr.active
             LIMIT 20),
            ARRAY[]::uuid[]
        ) as key_suggestions
    FROM params
    LIMIT 1
),
-- Model-key associations (from detail endpoint)
model_key_associations AS (
    SELECT DISTINCT
        dm.model_id,
        spk.key_id
    FROM department_models dm
    LEFT JOIN department_settings_for_model_keys dsfmk ON true
    LEFT JOIN model_providers mp ON mp.model_id = dm.model_id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = dsfmk.settings_id 
        AND spk.active = true
    WHERE spk.key_id IS NOT NULL
    AND (SELECT department_id FROM params) IS NOT NULL
),
-- Additional detail endpoint CTEs
runs_for_department_via_agents AS (
    SELECT DISTINCT mr.id as run_id
    FROM runs mr
    JOIN agent_departments ad ON NULL::uuid = mr.agent_id AND ad.active = true
    WHERE ad.department_id = (SELECT department_id FROM params) AND mr.agent_id IS NOT NULL
    AND (SELECT department_id FROM params) IS NOT NULL
),
runs_for_department_via_personas AS (
    SELECT DISTINCT mr.id as run_id
    FROM runs mr
    JOIN run_personas mrp ON mrp.run_id = mr.id AND mrp.active = true
    JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
    WHERE pd.department_id = (SELECT department_id FROM params)
    AND (SELECT department_id FROM params) IS NOT NULL
),
runs_for_department_via_profiles AS (
    SELECT DISTINCT mr.id as run_id
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id AND mrp.active = true
    JOIN profile_departments pd ON pd.profile_id = mrp.profile_id AND pd.active = true
    WHERE pd.department_id = (SELECT department_id FROM params)
    AND (SELECT department_id FROM params) IS NOT NULL
),
runs_for_department AS (
    SELECT run_id FROM runs_for_department_via_agents
    UNION
    SELECT run_id FROM runs_for_department_via_personas
    UNION
    SELECT run_id FROM runs_for_department_via_profiles
),
model_run_costs AS (
    SELECT 
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as cost
    FROM run_pricing_entry rpu
    JOIN runs_for_department rfd ON rfd.run_id = rpu.run_id
    JOIN run_models rm ON rm.run_id = rpu.run_id AND rm.active = true
    JOIN model_pricing mp ON mp.model_id = rm.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type 
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN units u ON u.id = rpu.unit_id
    GROUP BY rpu.run_id
),
department_price_spent AS (
    SELECT 
        (SELECT department_id FROM params) as department_id,
        COALESCE(SUM(mrc.cost), 0) as total_price_spent
    FROM model_run_costs mrc
    WHERE (SELECT department_id FROM params) IS NOT NULL
),
department_staff_count AS (
    SELECT 
        department_id, 
        COUNT(DISTINCT profile_id) as staff_count
    FROM profile_departments
    WHERE department_id = (SELECT department_id FROM params) AND active = true
    GROUP BY department_id
    HAVING (SELECT department_id FROM params) IS NOT NULL
),
department_usage AS (
    SELECT
        (SELECT COUNT(*) FROM profile_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM simulation_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM scenario_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM persona_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM document_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM cohort_departments WHERE department_id = (SELECT department_id FROM params) AND active = true) as total_usage
    WHERE (SELECT department_id FROM params) IS NOT NULL
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT department_exists FROM department_exists_check) as department_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Single-select resources: name
    nrd.name_id,
    COALESCE(nrd.draft_name_resource, nrd.department_name_resource) as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_department_v4_name_resource[]) as names,
    -- Single-select resources: description
    drd.description_id,
    COALESCE(drd.draft_description_resource, drd.department_description_resource) as description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_department_v4_description_resource[]) as descriptions,
    -- Single-select resources: flag
    frd.active_flag_id,
    COALESCE(frd.draft_flag_resource, frd.department_flag_resource) as flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_flag
    END as show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description, fd.icon_id, fd.generated)::types.q_get_department_v4_flag_resource
            ORDER BY fd.name
        ) FROM (SELECT DISTINCT id, name, description, icon_id, generated FROM flags_data) fd),
        '{}'::types.q_get_department_v4_flag_resource[]
    ) as flags,
    -- Multi-select resources: settings
    COALESCE((SELECT settings_ids FROM settings_ids_data), ARRAY[]::uuid[]) as settings_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.settings_id, sd.created_at, sd.active, sd.department_ids, sd.generated)::types.q_get_department_v4_setting
            ORDER BY sd.created_at DESC
        ) FROM (SELECT DISTINCT settings_id, created_at, active, department_ids, generated FROM settings_data) sd),
        '{}'::types.q_get_department_v4_setting[]
    ) as settings_resources,
    CASE 
        WHEN NOT tec.settings_has_tools THEN false
        ELSE uf.show_settings
    END as show_settings,
    (SELECT agent_id FROM settings_agent_data) as settings_agent_id,
    false as settings_required,
    COALESCE((SELECT settings_suggestions FROM settings_suggestions_data), ARRAY[]::uuid[]) as settings_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.settings_id, sd.created_at, sd.active, sd.department_ids, sd.generated)::types.q_get_department_v4_setting
            ORDER BY sd.created_at DESC
        ) FROM (SELECT DISTINCT settings_id, created_at, active, department_ids, generated FROM settings_data) sd),
        '{}'::types.q_get_department_v4_setting[]
    ) as settings,
    -- Multi-select resources: cohorts
    COALESCE((SELECT cohort_ids FROM cohort_ids_data), ARRAY[]::uuid[]) as cohort_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description, cd.generated)::types.q_get_department_v4_cohort
            ORDER BY cd.name
        ) FROM (
            SELECT DISTINCT cohort_id, name, description, generated 
            FROM cohorts_data cd2
            CROSS JOIN cohort_ids_data cid
            WHERE cd2.cohort_id = ANY(cid.cohort_ids)
        ) cd),
        '{}'::types.q_get_department_v4_cohort[]
    ) as cohort_resources,
    uf.show_cohorts,
    (SELECT agent_id FROM cohorts_agent_data) as cohorts_agent_id,
    false as cohorts_required,
    COALESCE((SELECT cohort_suggestions FROM cohort_suggestions_data), ARRAY[]::uuid[]) as cohort_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description, cd.generated)::types.q_get_department_v4_cohort
            ORDER BY cd.name
        ) FROM (SELECT DISTINCT cohort_id, name, description, generated FROM cohorts_data) cd),
        '{}'::types.q_get_department_v4_cohort[]
    ) as cohorts,
    -- Multi-select resources: departments
    COALESCE((SELECT department_ids FROM department_ids_data), ARRAY[]::uuid[]) as department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description, dd.generated)::types.q_get_department_v4_department
            ORDER BY dd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM departments_data) dd),
        '{}'::types.q_get_department_v4_department[]
    ) as department_resources,
    uf.show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    false as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description, dd.generated)::types.q_get_department_v4_department
            ORDER BY dd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM departments_data) dd),
        '{}'::types.q_get_department_v4_department[]
    ) as departments,
    -- Multi-select resources: models
    COALESCE((SELECT model_ids FROM model_ids_data), ARRAY[]::uuid[]) as model_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dm.model_id, dm.name, dm.description, dm.generated)::types.q_get_department_v4_model
            ORDER BY dm.name
        ) FROM (SELECT DISTINCT model_id, name, description, generated FROM department_models) dm),
        '{}'::types.q_get_department_v4_model[]
    ) as model_resources,
    uf.show_models,
    (SELECT agent_id FROM models_agent_data) as models_agent_id,
    false as models_required,
    COALESCE((SELECT model_suggestions FROM model_suggestions_data), ARRAY[]::uuid[]) as model_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dm.model_id, dm.name, dm.description, dm.generated)::types.q_get_department_v4_model
            ORDER BY dm.name
        ) FROM (SELECT DISTINCT model_id, name, description, generated FROM department_models) dm),
        '{}'::types.q_get_department_v4_model[]
    ) as models,
    -- Multi-select resources: keys
    COALESCE((SELECT key_ids FROM key_ids_data), ARRAY[]::uuid[]) as key_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (kd.key_id, kd.name, kd.description, kd.key_masked, kd.active, kd.generated)::types.q_get_department_v4_key
            ORDER BY kd.name
        ) FROM (SELECT DISTINCT key_id, name, description, key_masked, active, generated FROM keys_data) kd),
        '{}'::types.q_get_department_v4_key[]
    ) as key_resources,
    uf.show_keys,
    (SELECT agent_id FROM keys_agent_data) as keys_agent_id,
    false as keys_required,
    COALESCE((SELECT key_suggestions FROM key_suggestions_data), ARRAY[]::uuid[]) as key_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (kd.key_id, kd.name, kd.description, kd.key_masked, kd.active, kd.generated)::types.q_get_department_v4_key
            ORDER BY kd.name
        ) FROM (SELECT DISTINCT key_id, name, description, key_masked, active, generated FROM keys_data) kd),
        '{}'::types.q_get_department_v4_key[]
    ) as keys,
    -- Additional fields from detail endpoint
    CASE 
        WHEN (SELECT department_id FROM params) IS NULL THEN false::boolean
        WHEN up.role = 'superadmin' THEN true
        ELSE false
    END as can_duplicate,
    CASE 
        WHEN (SELECT department_id FROM params) IS NULL THEN false::boolean
        WHEN up.role = 'superadmin' AND COALESCE(du.total_usage, 0) = 0 THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN (SELECT department_id FROM params) IS NULL THEN false::boolean
        WHEN COALESCE(du.total_usage, 0) > 0 THEN true
        ELSE false
    END as in_use,
    COALESCE(dsc.staff_count, 0)::int as staff_count,
    COALESCE(dps.total_price_spent, 0)::float as total_price_spent,
    dcs.settings_id,
    COALESCE((SELECT array_agg(department_id ORDER BY name) FROM departments_data), ARRAY[]::uuid[])::uuid[] as valid_department_ids,
    COALESCE((SELECT array_agg(model_id ORDER BY name) FROM department_models), ARRAY[]::uuid[])::uuid[] as valid_model_ids,
    COALESCE((SELECT array_agg(key_id ORDER BY name) FROM keys_data), ARRAY[]::uuid[])::uuid[] as valid_key_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (mka.model_id, mka.key_id)::types.q_get_department_v4_model_key
            ORDER BY mka.model_id, mka.key_id
        ) FROM (SELECT DISTINCT model_id, key_id FROM model_key_associations) mka),
        '{}'::types.q_get_department_v4_model_key[]
    ) as model_keys,
    COALESCE(
        (SELECT draft_version FROM draft_payload_data),
        0::int
    ) as draft_version
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
LEFT JOIN department_current_settings dcs ON (SELECT department_id FROM params) IS NOT NULL
LEFT JOIN department_price_spent dps ON (SELECT department_id FROM params) IS NOT NULL
LEFT JOIN department_staff_count dsc ON (SELECT department_id FROM params) IS NOT NULL
LEFT JOIN department_usage du ON (SELECT department_id FROM params) IS NOT NULL
$$;
