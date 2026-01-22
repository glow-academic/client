-- Unified get field function - handles both new (field_id = NULL) and detail (field_id provided)
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
        WHERE proname = 'api_get_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_field_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_field_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_field_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_field_v4_name_resource AS (
    name_id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_field_v4_description_resource AS (
    description_id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_field_v4_flag_resource AS (
    flag_id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_field_v4(
    profile_id uuid,
    field_id uuid DEFAULT NULL,
    description_search text DEFAULT NULL,
    parameter_search text DEFAULT NULL,
    parameter_show_selected boolean DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    field_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_field_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_field_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_field_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_field_v4_description_resource[],
    -- Single-select resources: active flag
    active_flag_id uuid,
    active_flag_resource types.q_get_field_v4_flag_resource,
    show_active_flag boolean,
    active_flag_agent_id uuid,
    active_flag_required boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_field_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_field_v4_department[],
    -- Multi-select resources: parameters
    parameter_ids uuid[],
    parameter_resources types.q_get_field_v4_parameter[],
    show_parameters boolean,
    parameters_agent_id uuid,
    parameters_required boolean,
    parameter_suggestions uuid[],
    parameters types.q_get_field_v4_parameter[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        field_id AS field_id,
        profile_id AS profile_id,
        COALESCE(NULLIF(description_search, ''), NULL) AS description_search,
        COALESCE(NULLIF(parameter_search, ''), NULL) AS parameter_search,
        COALESCE(parameter_show_selected, false) AS parameter_show_selected,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check field existence if field_id provided
field_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM fields_resource WHERE id = (SELECT field_id FROM params))::boolean
        END as field_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
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
    LEFT JOIN resource_drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN resource_drafts d ON d.id = x.draft_id
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
-- Conditional: Get field department data only if field_id provided
field_departments_data AS (
    SELECT 
        CASE 
            WHEN x.field_id IS NOT NULL THEN fd.field_id
            ELSE NULL::uuid
        END as field_id,
        CASE 
            WHEN x.field_id IS NOT NULL THEN ARRAY_AGG(fd.department_id ORDER BY fd.created_at)
            ELSE NULL::uuid[]
        END as department_ids
    FROM params x
    LEFT JOIN field_departments fd ON fd.field_id = x.field_id AND fd.active = true
    GROUP BY x.field_id, fd.field_id
    LIMIT 1
),
-- Conditional: Get field parameter data only if field_id provided
field_parameters_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(
            ARRAY_AGG(pf.parameter_id ORDER BY pf.created_at) FILTER (WHERE pf.parameter_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) as parameter_ids
    FROM params x
    JOIN fields_resource f ON f.id = x.field_id
    LEFT JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
    WHERE x.field_id IS NOT NULL
    GROUP BY f.id
),
-- Department mapping data (only active departments user is linked to)
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
-- Parameter mapping data (only active parameters)
parameter_mapping_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        COALESCE(pr.generated, false) as generated
    FROM parameter_artifact p
    LEFT JOIN parameters_resource pr ON pr.parameter_id = p.id
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = true)
),
-- Field IDs (selected department IDs for field)
field_department_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(fd.department_id ORDER BY fd.created_at)
                 FROM field_departments fd
                 WHERE fd.field_id = (SELECT field_id FROM params)
                   AND fd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Parameter IDs (selected parameter IDs for field)
field_parameter_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pf.parameter_id ORDER BY pf.created_at)
                 FROM parameter_fields pf
                 WHERE pf.field_id = (SELECT field_id FROM params)
                   AND pf.active = true),
                ARRAY[]::uuid[]
            )
        END as parameter_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Name resource data
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT fn.name_id FROM field_names fn WHERE fn.field_id = (SELECT field_id FROM params) LIMIT 1),
            NULL::uuid
        ) as name_id
    FROM params
),
-- Description resource data
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT fd.description_id FROM field_descriptions fd WHERE fd.field_id = (SELECT field_id FROM params) LIMIT 1),
            NULL::uuid
        ) as description_id
    FROM params
),
-- Active flag resource data
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT ff.flag_id
             FROM field_flags ff
             JOIN flags_resource f ON f.id = ff.flag_id
             WHERE ff.field_id = (SELECT field_id FROM params)
               AND f.name = 'field_active'
               AND ff.value = true
             LIMIT 1),
            NULL::uuid
        ) as active_flag_id
    FROM params
),
-- Name suggestions: linked to fields OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(fn.name_id ORDER BY fn.created_at DESC)
             FROM (
                 SELECT DISTINCT fn.name_id, MAX(fn.created_at) as created_at
                 FROM field_names fn
                 JOIN names_resource n ON n.id = fn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE fn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to fields (validated by usage)
                       COALESCE(n.generated, false) = false
                       OR
                       -- Option 2: OR linked to same group with generated=true
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
                 GROUP BY fn.name_id
                 ORDER BY MAX(fn.created_at) DESC
                 LIMIT 20
             ) fn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_field_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_field_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to fields OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(fd.description_id ORDER BY fd.created_at DESC)
             FROM (
                 SELECT DISTINCT fd.description_id, MAX(fd.created_at) as created_at
                 FROM field_descriptions fd
                 JOIN descriptions_resource d ON d.id = fd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE fd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to fields (validated by usage)
                       COALESCE(d.generated, false) = false
                       OR
                       -- Option 2: OR linked to same group with generated=true
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
                 GROUP BY fd.description_id
                 ORDER BY MAX(fd.created_at) DESC
                 LIMIT 20
             ) fd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_field_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                CROSS JOIN params p
                WHERE d.description IS NOT NULL
                  AND d.description != ''
                  AND (
                      p.description_search IS NULL
                      OR LOWER(d.description) LIKE '%' || LOWER(p.description_search) || '%'
                  )
            ),
            ARRAY[]::types.q_get_field_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Department suggestions: linked to fields OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(fd.department_id ORDER BY fd.created_at DESC)
             FROM (
                 SELECT DISTINCT fd.department_id, MAX(fd.created_at) as created_at
                 FROM field_departments fd
                 JOIN departments_resource d ON d.id = fd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE fd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to fields with active=true
                       fd.active = true
                       OR
                       -- Option 2: OR linked to same group with generated=true
                       (
                           fd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY fd.department_id
                 ORDER BY MAX(fd.created_at) DESC
                 LIMIT 20
             ) fd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Parameter suggestions: linked to fields OR same group with generated=true
parameter_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pf.parameter_id ORDER BY pf.created_at DESC)
             FROM (
                 SELECT DISTINCT pf.parameter_id, MAX(pf.created_at) as created_at
                 FROM parameter_fields pf
                 JOIN parameter_artifact p ON p.id = pf.parameter_id
                 LEFT JOIN parameters_resource pr ON pr.parameter_id = p.id
                 CROSS JOIN draft_group_data dgd
                 WHERE pf.parameter_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM parameter_flags pf2 JOIN flags_resource f ON pf2.flag_id = f.id WHERE pf2.parameter_id = p.id AND f.name = 'parameter_active' AND pf2.value = true)
                   AND (
                       -- Option 1: Linked to fields (validated by usage)
                       pf.generated = false
                       OR
                       -- Option 2: OR linked to same group with generated=true
                       (
                           pf.generated = true
                           AND COALESCE(pr.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = pr.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pf.parameter_id
                 ORDER BY MAX(pf.created_at) DESC
                 LIMIT 20
             ) pf),
            ARRAY[]::uuid[]
        ) as parameter_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_active_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM parameter_mapping_data) > 0 THEN true
            ELSE false
        END as show_parameters
    FROM params x
    CROSS JOIN user_profile up
),
-- Agent selection helper CTEs (shared across all agent selections)
field_department_for_agents AS (
    SELECT fd.department_id
    FROM params p
    JOIN field_departments fd ON fd.field_id = p.field_id AND fd.active = true
    WHERE p.field_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.field_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM field_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources ar ON ar.resource = rt.resource AND ar.artifact = 'field'::artifacts
    GROUP BY a.id
),

-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'field'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'field'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'flags' resource
active_flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'field'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'field'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'parameters' resource
parameters_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'field'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'parameters'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Check for missing tools on required resources (after all agent selection CTEs and ui_flags)
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
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
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'parameters'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as parameters_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.parameters_has_tools AND uf.show_parameters THEN 'parameters' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        fdd.department_ids,
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (SELECT 1 FROM user_departments) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN fdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT field_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN fdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default field that cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This field cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN field_departments_data fdd ON true
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
-- Department resources (selected departments filtered by department_ids)
department_resources_data AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_field_v4_department
                    ORDER BY array_position(fdid.department_ids, dmd.department_id)
                )
                FROM field_department_ids_data fdid
                JOIN department_mapping_data dmd ON dmd.department_id = ANY(fdid.department_ids)
            ),
            '{}'::types.q_get_field_v4_department[]
        ) as department_resources
    FROM params
    LIMIT 1
),
-- Parameter resources (selected parameters filtered by parameter_ids)
parameter_resources_data AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (pmd.parameter_id, pmd.name, pmd.description, pmd.generated)::types.q_get_field_v4_parameter
                    ORDER BY array_position(fpid.parameter_ids, pmd.parameter_id)
                )
                FROM field_parameter_ids_data fpid
                JOIN parameter_mapping_data pmd ON pmd.parameter_id = ANY(fpid.parameter_ids)
            ),
            '{}'::types.q_get_field_v4_parameter[]
        ) as parameter_resources
    FROM params
    LIMIT 1
),
-- User has field access check (only for detail mode)
user_has_field_access AS (
    SELECT EXISTS(
        SELECT 1 FROM field_departments fd
        JOIN profile_departments pd ON pd.department_id = fd.department_id
        WHERE fd.field_id = (SELECT field_id FROM params)
        AND fd.active = true
        AND pd.profile_id = (SELECT profile_id FROM params)
        AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
        WHERE EXISTS (
            SELECT 1 FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            AND r.role = 'superadmin'::profile_role
        )
    ) OR (
        SELECT NOT EXISTS(
            SELECT 1 FROM field_departments fd2
            WHERE fd2.field_id = (SELECT field_id FROM params)
            AND fd2.active = true
        )
    ) as has_access
    FROM params x
    WHERE x.field_id IS NOT NULL
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT field_exists FROM field_exists_check) as field_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    -- Group ID for linking resources
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    (
        SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_field_v4_name_resource
        FROM name_resource_data nrd
        JOIN names_resource n ON n.id = nrd.name_id
        LIMIT 1
    ) as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_field_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (
        SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_field_v4_description_resource
        FROM description_resource_data drd
        JOIN descriptions_resource d ON d.id = drd.description_id
        LIMIT 1
    ) as description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_field_v4_description_resource[]) as descriptions,
    -- Single-select resources: active flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (
        SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_field_v4_flag_resource
        FROM flag_resource_data frd
        JOIN flags_resource f ON f.id = frd.active_flag_id
        LIMIT 1
    ) as active_flag_resource,
    uf.show_active_flag,
    (SELECT agent_id FROM active_flag_agent_data) as active_flag_agent_id,
    false as active_flag_required,
    -- Multi-select resources: departments
    (SELECT department_ids FROM field_department_ids_data) as department_ids,
    (SELECT department_resources FROM department_resources_data) as department_resources,
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
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_field_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_field_v4_department[]
    ) as departments,
    -- Multi-select resources: parameters
    (SELECT parameter_ids FROM field_parameter_ids_data) as parameter_ids,
    (SELECT parameter_resources FROM parameter_resources_data) as parameter_resources,
    CASE 
        WHEN NOT tec.parameters_has_tools AND uf.show_parameters THEN false
        WHEN EXISTS (SELECT 1 FROM parameter_mapping_data LIMIT 1) THEN true
        ELSE uf.show_parameters
    END as show_parameters,
    (SELECT agent_id FROM parameters_agent_data) as parameters_agent_id,
    CASE 
        WHEN uf.show_parameters THEN true
        ELSE false
    END as parameters_required,
    COALESCE((SELECT parameter_suggestions FROM parameter_suggestions_data), ARRAY[]::uuid[]) as parameter_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.generated)::types.q_get_field_v4_parameter
            ORDER BY pmd.name
        ) FROM (
            SELECT DISTINCT pmd.parameter_id, pmd.name, pmd.description, pmd.generated
            FROM parameter_mapping_data pmd
            CROSS JOIN params p
            WHERE pmd.parameter_id IS NOT NULL
              AND (
                  p.parameter_search IS NULL
                  OR LOWER(pmd.name) LIKE '%' || LOWER(p.parameter_search) || '%'
                  OR LOWER(pmd.description) LIKE '%' || LOWER(p.parameter_search) || '%'
              )
              AND (
                  NOT p.parameter_show_selected
                  OR pmd.parameter_id = ANY(
                      COALESCE(
                          (SELECT parameter_ids FROM field_parameter_ids_data),
                          ARRAY[]::uuid[]
                      )
                  )
              )
        ) pmd),
        '{}'::types.q_get_field_v4_parameter[]
    ) as parameters
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN field_departments_data fdd ON true
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN field_department_ids_data fdid
CROSS JOIN field_parameter_ids_data fpid
LEFT JOIN user_has_field_access uha ON (SELECT field_id FROM params) IS NOT NULL
WHERE 
    -- For new mode: always return
    (SELECT field_id FROM params) IS NULL
    OR
    -- For detail mode: only return if field exists and user has access
    (
        COALESCE((SELECT field_exists FROM field_exists_check), false) = true
        AND (
            COALESCE((SELECT has_access FROM user_has_field_access), false) = true
            OR (SELECT field_exists FROM field_exists_check) = false
        )
    )
$$;
