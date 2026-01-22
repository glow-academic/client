-- Unified get parameter function - handles both new (parameter_id = NULL) and detail (parameter_id provided)
-- Converted to function with composite types following ARTIFACT.md
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_parameter_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_parameter_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_parameter_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_field AS (
    field_id uuid,
    name text,
    description text,
    usage_count bigint,
    department_ids text[],
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_name_resource AS (
    name_id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_description_resource AS (
    description_id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_flag_resource AS (
    flag_id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_parameter_v4(
    profile_id uuid,
    parameter_id uuid DEFAULT NULL,
    field_search text DEFAULT NULL,
    field_show_selected boolean DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    parameter_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_parameter_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_parameter_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_parameter_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_parameter_v4_description_resource[],
    -- Single-select resources: active flag
    active_flag_id uuid,
    active_flag_resource types.q_get_parameter_v4_flag_resource,
    show_active_flag boolean,
    active_flag_agent_id uuid,
    active_flag_required boolean,
    -- Parameter data fields
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_parameter_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_parameter_v4_department[],
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_parameter_v4_field[],
    show_fields boolean,
    fields_agent_id uuid,
    fields_required boolean,
    field_suggestions uuid[],
    fields types.q_get_parameter_v4_field[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        parameter_id AS parameter_id,
        profile_id AS profile_id,
        field_search AS field_search,
        COALESCE(field_show_selected, false) AS field_show_selected,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check parameter existence if parameter_id provided
parameter_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM parameter_artifact WHERE id = (SELECT parameter_id FROM params))::boolean
        END as parameter_exists
),
-- Draft data (no payload needed per ARTIFACT.md)
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
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
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get parameter department data only if parameter_id provided
parameter_departments_data AS (
    SELECT 
        pd.parameter_id,
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) as department_ids
    FROM params x
    JOIN parameter_departments pd ON pd.parameter_id = x.parameter_id AND pd.active = true
    WHERE x.parameter_id IS NOT NULL
    GROUP BY pd.parameter_id
),
-- Name ID data
name_id_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id
             FROM names_draft dn
             WHERE dn.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            CASE 
                WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::uuid
                ELSE (
                    SELECT pn.name_id
                    FROM parameter_names pn
                    WHERE pn.parameter_id = (SELECT parameter_id FROM params)
                      AND pn.active = true
                    LIMIT 1
                )
            END
        ) as name_id
    FROM params
    LIMIT 1
),
-- Description ID data
description_id_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id
             FROM descriptions_draft dd
             WHERE dd.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            CASE 
                WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::uuid
                ELSE (
                    SELECT pd.description_id
                    FROM parameter_descriptions pd
                    WHERE pd.parameter_id = (SELECT parameter_id FROM params)
                      AND pd.active = true
                    LIMIT 1
                )
            END
        ) as description_id
    FROM params
    LIMIT 1
),
-- Name suggestions: linked to parameters OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM parameter_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       COALESCE(n.generated, false) = false
                       OR (
                           COALESCE(n.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = n.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pn.name_id
                 ORDER BY MAX(pn.created_at) DESC
                 LIMIT 20
             ) pn),
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
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_parameter_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_parameter_v4_name_resource[]
        ) as names
    FROM params
    LIMIT 1
),
-- Description suggestions: linked to parameters OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.description_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.description_id, MAX(pd.created_at) as created_at
                 FROM parameter_descriptions pd
                 JOIN descriptions_resource d ON d.id = pd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       COALESCE(d.generated, false) = false
                       OR (
                           COALESCE(d.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pd.description_id
                 ORDER BY MAX(pd.created_at) DESC
                 LIMIT 20
             ) pd),
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
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_parameter_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_parameter_v4_description_resource[]
        ) as descriptions
    FROM params
    LIMIT 1
),
-- Active flag ID data
active_flag_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN (
                SELECT df.flags_id
                FROM flags_draft df
                JOIN flags_resource f ON f.id = df.flags_id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND f.name = 'parameter_active'
                  AND df.active = true
                LIMIT 1
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::uuid
            ELSE (
                SELECT pf.flag_id
                FROM parameter_flags pf
                JOIN flags_resource f ON f.id = pf.flag_id
                WHERE pf.parameter_id = (SELECT parameter_id FROM params)
                  AND f.name = 'parameter_active'
                  AND pf.value = true
                  AND pf.active = true
                LIMIT 1
            )
        END as active_flag_id
    FROM params
    LIMIT 1
),
-- Active flag resource data
active_flag_resource_data AS (
    SELECT 
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_parameter_v4_flag_resource
            FROM flags_resource f
            WHERE f.id = (SELECT active_flag_id FROM active_flag_id_data)
            LIMIT 1
        ) as active_flag_resource
    FROM params
    LIMIT 1
),
-- Parameter data (conditional based on mode)
parameter_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN (
                SELECT n.name
                FROM names_resource n
                WHERE n.id = (SELECT name_id FROM name_id_data)
                LIMIT 1
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::text
            ELSE (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT parameter_id FROM params) AND pn.active = true LIMIT 1)
        END as name,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN (
                SELECT d.description
                FROM descriptions_resource d
                WHERE d.id = (SELECT description_id FROM description_id_data)
                LIMIT 1
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::text
            ELSE (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = (SELECT parameter_id FROM params) AND pd.active = true LIMIT 1)
        END as description,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource fl ON df.flags_id = fl.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND fl.name = 'active'
                  AND df.active = true
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN false
            ELSE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = (SELECT parameter_id FROM params) AND fl.name = 'parameter_active' AND paf.value = TRUE AND paf.active = true)
        END as active,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource fl ON df.flags_id = fl.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND fl.name = 'simulation_parameter'
                  AND df.active = true
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN false
            ELSE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = (SELECT parameter_id FROM params) AND fl.name = 'simulation_parameter' AND paf.value = TRUE AND paf.active = true)
        END as simulation_parameter,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource fl ON df.flags_id = fl.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND fl.name = 'document_parameter'
                  AND df.active = true
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN false
            ELSE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = (SELECT parameter_id FROM params) AND fl.name = 'document_parameter' AND paf.value = TRUE AND paf.active = true)
        END as document_parameter,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource fl ON df.flags_id = fl.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND fl.name = 'persona_parameter'
                  AND df.active = true
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN false
            ELSE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = (SELECT parameter_id FROM params) AND fl.name = 'persona_parameter' AND paf.value = TRUE AND paf.active = true)
        END as persona_parameter,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource fl ON df.flags_id = fl.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND fl.name = 'scenario_parameter'
                  AND df.active = true
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN false
            ELSE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = (SELECT parameter_id FROM params) AND fl.name = 'scenario_parameter' AND paf.value = TRUE AND paf.active = true)
        END as scenario_parameter,
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN EXISTS (
                SELECT 1
                FROM flags_draft df
                JOIN flags_resource fl ON df.flags_id = fl.id
                WHERE df.draft_id = (SELECT draft_id FROM params)
                  AND fl.name = 'video_parameter'
                  AND df.active = true
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN false
            ELSE EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = (SELECT parameter_id FROM params) AND fl.name = 'video_parameter' AND paf.value = TRUE AND paf.active = true)
        END as video_parameter
    FROM params
    LIMIT 1
),
-- Department mapping data (for multi-select resource pattern)
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
-- All available fields (not just connected ones)
all_fields_data AS (
    SELECT 
        f.field_id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM fields_resource f
    LEFT JOIN field_departments fd ON fd.field_id = f.field_id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.field_id AND fl.name = 'field_active' AND ff.value = true)
    GROUP BY f.field_id
),
all_fields_with_usage AS (
    SELECT 
        f.field_id as id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.field_id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.field_id LIMIT 1),
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(afd.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(f.generated, false) as generated
    FROM fields_resource f 
    LEFT JOIN all_fields_data afd ON afd.field_id = f.field_id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.field_id AND fl.name = 'field_active' AND ff.value = true)
    GROUP BY f.id, f.field_id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.field_id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.field_id LIMIT 1), afd.department_ids, f.generated
),
-- Tool existence checks
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'fields'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as fields_has_tools
    FROM params x
),
-- UI flags (show flags for resources)
ui_flags AS (
    SELECT 
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM all_fields_with_usage) > 0 THEN true
            ELSE false
        END as show_fields
    FROM params x
),
-- Missing tools check
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.fields_has_tools AND uf.show_fields THEN 'fields' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
-- Permissions data
permissions_data_with_tools AS (
    SELECT 
        pdd.department_ids,
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (SELECT 1 FROM user_departments LIMIT 1) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN pdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN pdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default parameter that cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This parameter cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN parameter_departments_data pdd ON true
    CROSS JOIN user_profile up
),
permissions_final AS (
    SELECT 
        pd.department_ids,
        mtc.missing_resources,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
),
-- Agent selection CTEs (simplified - parameters don't have complex agent selection like personas)
departments_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
fields_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
-- Department suggestions: linked to parameters with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.department_id, MAX(pd.created_at) as created_at
                 FROM parameter_departments pd
                 JOIN departments_resource d ON d.id = pd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       pd.active = true
                       OR
                       (
                           pd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pd.department_id
                 ORDER BY MAX(pd.created_at) DESC
                 LIMIT 20
             ) pd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Field suggestions: linked to parameters with active=true OR same group with generated=true
field_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at DESC)
             FROM (
                 SELECT DISTINCT pf.field_id, MAX(pf.created_at) as created_at
                 FROM parameter_fields pf
                 JOIN fields_resource f2 ON f2.field_id = pf.field_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pf.field_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f2.field_id AND fl.name = 'field_active' AND ff.value = true)
                   AND (
                       pf.active = true
                       OR
                       (
                           pf.generated = true
                           AND f2.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = f2.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pf.field_id
                 ORDER BY MAX(pf.created_at) DESC
                 LIMIT 20
             ) pf),
            ARRAY[]::uuid[]
        ) as field_suggestions
    FROM params
    LIMIT 1
),
-- Resource IDs data (selected IDs for parameter)
department_ids_data AS (
    SELECT 
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
                 FROM departments_draft dd
                 WHERE dd.draft_id = (SELECT draft_id FROM params)
                   AND dd.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                 FROM parameter_departments pd
                 WHERE pd.parameter_id = (SELECT parameter_id FROM params)
                   AND pd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
field_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(df.fields_id ORDER BY df.created_at)
                 FROM fields_draft df
                 WHERE df.draft_id = (SELECT draft_id FROM params)
                   AND df.active = true
                   AND EXISTS (
                       SELECT 1
                       FROM field_flags ff
                       JOIN flags_resource fl ON ff.flag_id = fl.id
                       WHERE ff.field_id = df.fields_id
                         AND fl.name = 'active'
                         AND ff.value = true
                   )),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at)
                 FROM parameter_fields pf
                 WHERE pf.parameter_id = (SELECT parameter_id FROM params)
                   AND pf.active = true
                   AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = pf.field_id AND fl.name = 'field_active' AND ff.value = true)),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT parameter_exists FROM parameter_exists_check) as parameter_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,
    -- Single-select resources: name
    nid.name_id,
    (
        SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_parameter_v4_name_resource
        FROM names_resource n
        WHERE n.id = nid.name_id
        LIMIT 1
    ) as name_resource,
    true as show_name,
    NULL::uuid as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    (SELECT names FROM names_suggestions_objects) as names,
    -- Single-select resources: description
    did.description_id,
    (
        SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_parameter_v4_description_resource
        FROM descriptions_resource d
        WHERE d.id = did.description_id
        LIMIT 1
    ) as description_resource,
    true as show_description,
    NULL::uuid as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    (SELECT descriptions FROM descriptions_suggestions_objects) as descriptions,
    -- Single-select resources: active flag
    (SELECT active_flag_id FROM active_flag_id_data) as active_flag_id,
    (SELECT active_flag_resource FROM active_flag_resource_data) as active_flag_resource,
    true as show_active_flag,
    NULL::uuid as active_flag_agent_id,
    false as active_flag_required,
    -- Parameter data fields
    pd.name::text as name,
    pd.description::text as description,
    COALESCE(pd.active, false)::boolean as active,
    COALESCE(pd.simulation_parameter, false)::boolean as simulation_parameter,
    COALESCE(pd.document_parameter, false)::boolean as document_parameter,
    COALESCE(pd.persona_parameter, false)::boolean as persona_parameter,
    COALESCE(pd.scenario_parameter, false)::boolean as scenario_parameter,
    COALESCE(pd.video_parameter, false)::boolean as video_parameter,
    -- Multi-select resources: departments
    did_dept.department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_parameter_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(did_dept.department_ids)),
        '{}'::types.q_get_parameter_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_parameter_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_parameter_v4_department[]
    ) as departments,
    -- Multi-select resources: fields
    fid.field_ids,
    -- Field resources (selected fields filtered by field_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids, afwu.generated)::types.q_get_parameter_v4_field
            ORDER BY afwu.name
        )
        FROM all_fields_with_usage afwu
        WHERE afwu.id = ANY(fid.field_ids)),
        '{}'::types.q_get_parameter_v4_field[]
    ) as field_resources,
    CASE 
        WHEN NOT tec.fields_has_tools AND uf.show_fields THEN false
        ELSE uf.show_fields
    END as show_fields,
    (SELECT agent_id FROM fields_agent_data) as fields_agent_id,
    CASE 
        WHEN uf.show_fields THEN true
        ELSE false
    END as fields_required,
    COALESCE((SELECT field_suggestions FROM field_suggestions_data), ARRAY[]::uuid[]) as field_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids, afwu.generated)::types.q_get_parameter_v4_field
            ORDER BY afwu.name
        ) FROM (
            SELECT DISTINCT afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids, afwu.generated
            FROM all_fields_with_usage afwu
            CROSS JOIN params p
            WHERE 
                afwu.id IS NOT NULL
                -- Search filter: if field_search provided, match name or description
                AND (p.field_search IS NULL OR p.field_search = '' OR
                 LOWER(afwu.name) LIKE '%' || LOWER(p.field_search) || '%' OR
                 LOWER(afwu.description) LIKE '%' || LOWER(p.field_search) || '%')
                -- Show selected filter: if enabled, only show selected fields
                AND (
                    NOT p.field_show_selected OR
                    afwu.id = ANY(fid.field_ids)
                )
        ) afwu),
        '{}'::types.q_get_parameter_v4_field[]
    ) as fields
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN parameter_departments_data pdd ON true
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_id_data nid
CROSS JOIN description_id_data did
CROSS JOIN parameter_data pd
CROSS JOIN department_ids_data did_dept
CROSS JOIN field_ids_data fid
$$;
