-- Unified get tool function - handles both new (tool_id = NULL) and detail (tool_id provided)
-- Converted to function with composite types following ARTIFACT.md pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tool_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_tool_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (only necessary types per SPEC.md)
CREATE TYPE types.q_get_tool_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_domain AS (
    domain_id uuid,
    resource text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_args_resource AS (
    id uuid,
    name text,
    description text,
    field_type text,
    required boolean,
    default_value text,
    position integer,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_tool_v4_args_outputs_resource AS (
    id uuid,
    args_id uuid,
    name text,
    template text,
    generated boolean,
    group_id uuid
);

CREATE TYPE types.q_get_tool_v4_args_field_detail AS (
    args_id uuid,
    name text,
    description text,
    field_type text,
    required boolean,
    default_value text,
    position integer,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_args_outputs_detail AS (
    args_outputs_id uuid,
    args_id uuid,
    name text,
    template text,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_tool_v4(
    profile_id uuid,
    tool_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    -- Required fields (first 5)
    tool_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Tool basic fields (FROM tool_artifact table)
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    -- Single-select resources: name
    names_id uuid,
    name_resource types.q_get_tool_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_tool_v4_name_resource[],
    -- Single-select resources: description
    descriptions_id uuid,
    description_resource types.q_get_tool_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_tool_v4_description_resource[],
    -- Domain connections (for scoping logic)
    domain_ids uuid[],
    domain_resources types.q_get_tool_v4_domain[],
    -- Multi-select resources: args
    args_ids uuid[],
    args_resources types.q_get_tool_v4_args_resource[],
    show_args boolean,
    args_agent_id uuid,
    args_required boolean,
    args_suggestions uuid[],
    args types.q_get_tool_v4_args_resource[],
    -- Multi-select resources: args_outputs
    args_outputs_ids uuid[],
    args_outputs_resources types.q_get_tool_v4_args_outputs_resource[],
    show_args_outputs boolean,
    args_outputs_agent_id uuid,
    args_outputs_required boolean,
    args_outputs_suggestions uuid[],
    args_outputs types.q_get_tool_v4_args_outputs_resource[],
    -- Input args fields detail (for Args component - fields from selected args_ids)
    input_args_fields types.q_get_tool_v4_args_field_detail[],
    -- Output args_outputs detail (for ArgsOutputs component - args_outputs from selected args_outputs_ids)
    output_args_outputs types.q_get_tool_v4_args_outputs_detail[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        tool_id AS tool_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check tool existence if tool_id provided
tool_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM tool_artifact WHERE id = (SELECT tool_id FROM params))::boolean
        END as tool_exists
    FROM params
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT
        COALESCE(
            draft_group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
),
draft_version_data AS (
    SELECT draft_version as draft_version
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Tool data (FROM tool_artifact table)
tool_data AS (
    SELECT 
        t.id,
        (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.names_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.descriptions_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true) as active,
        t.updated_at
    FROM params x
    LEFT JOIN tool_artifact t ON t.id = x.tool_id
    WHERE x.tool_id IS NOT NULL
    LIMIT 1
),
-- Name ID (selected name ID for tool)
name_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT tn.names_id FROM tool_names_junction tn WHERE tn.tool_id = (SELECT tool_id FROM params) LIMIT 1)
        END as names_id
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Name suggestions: linked to tools OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(tn.names_id ORDER BY tn.created_at DESC)
             FROM (
                 SELECT DISTINCT tn.names_id, MAX(tn.created_at) as created_at
                 FROM tool_names_junction tn
                 JOIN names_resource n ON n.id = tn.names_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tn.names_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to tools (tool_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tn.generated = false
                       OR
                       (
                           tn.generated = true
                           AND n.generated = true
                       )
                   )
                 GROUP BY tn.names_id
                 ORDER BY MAX(tn.created_at) DESC
                 LIMIT 20
             ) tn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Name mapping (for names array - suggested options only)
name_mapping_data AS (
    SELECT 
        n.id,
        n.name,
        COALESCE(tn.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    CROSS JOIN name_suggestions_data nsd
    JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id ON true
    JOIN names_resource n ON n.id = suggestion_id
    LEFT JOIN tool_names_junction tn ON tn.names_id = n.id AND tn.tool_id = x.tool_id
    WHERE n.name IS NOT NULL AND n.name != ''
),
-- Names suggestions objects (for names array - suggested options only)
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(tn.generated, false))::types.q_get_tool_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                LEFT JOIN tool_names_junction tn ON tn.names_id = n.id AND tn.tool_id = (SELECT tool_id FROM params)
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_tool_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description ID (selected description ID for tool)
description_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT td.descriptions_id FROM tool_descriptions_junction td WHERE td.tool_id = (SELECT tool_id FROM params) LIMIT 1)
        END as descriptions_id
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to tools OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(td.descriptions_id ORDER BY td.created_at DESC)
             FROM (
                 SELECT DISTINCT td.descriptions_id, MAX(td.created_at) as created_at
                 FROM tool_descriptions_junction td
                 JOIN descriptions_resource d ON d.id = td.descriptions_id
                 CROSS JOIN draft_group_data dgd
                 WHERE td.descriptions_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to tools (tool_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       td.generated = false
                       OR
                       (
                           td.generated = true
                           AND d.generated = true
                       )
                   )
                 GROUP BY td.descriptions_id
                 ORDER BY MAX(td.created_at) DESC
                 LIMIT 20
             ) td),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description mapping (for descriptions array - suggested options only)
description_mapping_data AS (
    SELECT 
        d.id,
        d.description,
        COALESCE(td.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    CROSS JOIN description_suggestions_data dsd
    JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id ON true
    JOIN descriptions_resource d ON d.id = suggestion_id
    LEFT JOIN tool_descriptions_junction td ON td.descriptions_id = d.id AND td.tool_id = x.tool_id
    WHERE d.description IS NOT NULL AND d.description != ''
),
-- Descriptions suggestions objects (for descriptions array - suggested options only)
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(td.generated, false))::types.q_get_tool_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                LEFT JOIN tool_descriptions_junction td ON td.descriptions_id = d.id AND td.tool_id = (SELECT tool_id FROM params)
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_tool_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Domain IDs (selected domain IDs for tool)
domain_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(td.resources_id ORDER BY td.created_at)
                 FROM tool_resources_junction td
                 WHERE td.tool_id = (SELECT tool_id FROM params) AND td.active = true),
                ARRAY[]::uuid[]
            )
        END as resource_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Domain mapping (for domain_resources array)
domain_mapping_data AS (
    SELECT 
        d.id as resources_id,
        d.resource::text,
        COALESCE(td.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN resources_resource d ON d.active = true
    LEFT JOIN tool_resources_junction td ON td.resources_id = d.id AND td.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all resources for new tools
),
-- Args IDs (selected args IDs for tool)
args_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(da.args_id ORDER BY da.created_at)
                 FROM tool_drafts_args_connection da
                 WHERE da.draft_id = (SELECT draft_id FROM params)),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ta.args_id ORDER BY ta.created_at)
                 FROM tool_args_junction ta
                 WHERE ta.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as args_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Args suggestions: linked to tools OR same group with generated=true
args_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ta.args_id ORDER BY ta.created_at DESC)
             FROM (
                 SELECT DISTINCT ta.args_id, MAX(ta.created_at) as created_at
                 FROM tool_args_junction ta
                 JOIN args_resource a ON a.id = ta.args_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ta.args_id IS NOT NULL
                   AND a.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_args_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ta.generated = false
                       OR
                       (
                           ta.generated = true
                           AND a.generated = true
                       )
                   )
                 GROUP BY ta.args_id
                 ORDER BY MAX(ta.created_at) DESC
                 LIMIT 20
             ) ta),
            ARRAY[]::uuid[]
        ) as args_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Args mapping (for args array - all available args)
args_mapping_data AS (
    SELECT 
        a.id,
        a.name,
        a.description,
        a.field_type,
        a.required,
        a.default_value,
        0 as position,
        COALESCE(ta.generated, false) as generated,
        NULL::uuid as group_id
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN args_resource a ON a.active = true
    LEFT JOIN tool_args_junction ta ON ta.args_id = a.id AND ta.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all args for new tools
),
-- Args outputs IDs (selected args_outputs IDs for tool)
args_outputs_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(dao.args_outputs_id ORDER BY dao.created_at)
                 FROM tool_drafts_args_outputs_connection dao
                 WHERE dao.draft_id = (SELECT draft_id FROM params)),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tao.args_outputs_id ORDER BY tao.created_at)
                 FROM tool_args_outputs_junction tao
                 WHERE tao.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as args_outputs_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Args outputs suggestions: linked to tools OR same group with generated=true
args_outputs_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(tao.args_outputs_id ORDER BY tao.created_at DESC)
             FROM (
                 SELECT DISTINCT tao.args_outputs_id, MAX(tao.created_at) as created_at
                 FROM tool_args_outputs_junction tao
                 JOIN args_outputs_resource ao ON ao.id = tao.args_outputs_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tao.args_outputs_id IS NOT NULL
                   AND ao.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_args_outputs_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tao.generated = false
                       OR
                       (
                           tao.generated = true
                           AND ao.generated = true
                       )
                   )
                 GROUP BY tao.args_outputs_id
                 ORDER BY MAX(tao.created_at) DESC
                 LIMIT 20
             ) tao),
            ARRAY[]::uuid[]
        ) as args_outputs_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Args outputs mapping (for args_outputs array - all available args_outputs)
args_outputs_mapping_data AS (
    SELECT
        ao.id,
        ao.args_id,
        ao.name,
        ao.template,
        COALESCE(tao.generated, false) as generated,
        NULL::uuid as group_id
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN args_outputs_resource ao ON ao.active = true
    LEFT JOIN tool_args_outputs_junction tao ON tao.args_outputs_id = ao.id AND tao.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all args_outputs for new tools
),
-- Input args fields detail (for Args component - fields from selected args_ids)
input_args_fields_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (a.id, a.name, COALESCE(a.description, ''), COALESCE(a.field_type, ''), COALESCE(a.required, false), COALESCE(a.default_value, ''), 0, COALESCE(ta.generated, false))::types.q_get_tool_v4_args_field_detail
                ORDER BY a.name
            )
            FROM params x
            CROSS JOIN args_ids_data aid
            JOIN args_resource a ON a.id = ANY(aid.args_ids) AND a.active = true
            LEFT JOIN tool_args_junction ta ON ta.args_id = a.id AND ta.tool_id = x.tool_id
            WHERE COALESCE(array_length(aid.args_ids, 1), 0) > 0),
            ARRAY[]::types.q_get_tool_v4_args_field_detail[]
        ) as input_args_fields
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Output args_outputs detail (for ArgsOutputs component - args_outputs from selected args_outputs_ids)
output_args_outputs_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (ao.id, ao.args_id, ao.name, COALESCE(ao.template, ''), COALESCE(tao.generated, false))::types.q_get_tool_v4_args_outputs_detail
                ORDER BY ao.name
            )
            FROM params x
            CROSS JOIN args_outputs_ids_data aoid
            JOIN args_outputs_resource ao ON ao.id = ANY(aoid.args_outputs_ids) AND ao.active = true
            LEFT JOIN tool_args_outputs_junction tao ON tao.args_outputs_id = ao.id AND tao.tool_id = x.tool_id
            WHERE COALESCE(array_length(aoid.args_outputs_ids, 1), 0) > 0),
            ARRAY[]::types.q_get_tool_v4_args_outputs_detail[]
        ) as output_args_outputs
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist AND tool availability)
        CASE 
            WHEN (SELECT COUNT(*) FROM name_mapping_data) > 0 THEN true
            ELSE false
        END as show_name,
        CASE 
            WHEN (SELECT COUNT(*) FROM description_mapping_data) > 0 THEN true
            ELSE false
        END as show_description,
        -- Multi-select resource flags (based on business logic AND tool availability)
        CASE 
            WHEN (SELECT COUNT(*) FROM args_mapping_data) > 0 THEN true
            ELSE false
        END as show_args,
        CASE 
            WHEN (SELECT COUNT(*) FROM args_outputs_mapping_data) > 0 THEN true
            ELSE false
        END as show_args_outputs
    FROM params x
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        (SELECT department_id FROM profile_primary_department_for_agents) as department_id
    FROM params
    LIMIT 1
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN dr_rt.resource = ANY(ARRAY['arg_positions','args','args_outputs','bindings','departments','descriptions','domains','flags','names','tools']::resource_type[]) THEN dr_rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN dr_rt.resource IS NOT NULL AND NOT (dr_rt.resource = ANY(ARRAY['arg_positions','args','args_outputs','bindings','departments','descriptions','domains','flags','names','tools']::resource_type[])) THEN dr_rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags_junction tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true
    )
    LEFT JOIN tool_resources_junction tdj_rt ON tdj_rt.tool_id = t.id AND tdj_rt.active = true
    LEFT JOIN resources_resource dr_rt ON dr_rt.id = tdj_rt.resources_id AND dr_rt.active = true
    GROUP BY a.id
),

-- Agent selection for 'names' resource
names_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND f.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN tool_tools_junction ttj_rt ON ttj_rt.tool_id = tr_rt.id
            JOIN tool_resources_junction tdj_rt ON tdj_rt.tool_id = ttj_rt.tool_id AND tdj_rt.active = true
            JOIN resources_resource dr_rt ON dr_rt.id = tdj_rt.resources_id AND dr_rt.active = true
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND dr_rt.resource = ANY(ARRAY['arg_positions','args','args_outputs','bindings','departments','descriptions','domains','flags','names','tools']::resource_type[])
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
            JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            WHERE at.agent_id = a.id AND at.active = true
              AND dr.resource = 'names'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND f_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
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
descriptions_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND f.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN tool_tools_junction ttj_rt ON ttj_rt.tool_id = tr_rt.id
            JOIN tool_resources_junction tdj_rt ON tdj_rt.tool_id = ttj_rt.tool_id AND tdj_rt.active = true
            JOIN resources_resource dr_rt ON dr_rt.id = tdj_rt.resources_id AND dr_rt.active = true
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND dr_rt.resource = ANY(ARRAY['arg_positions','args','args_outputs','bindings','departments','descriptions','domains','flags','names','tools']::resource_type[])
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
            JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            WHERE at.agent_id = a.id AND at.active = true
              AND dr.resource = 'descriptions'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND f_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
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
-- Agent selection for 'args' resource
args_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND f.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN tool_tools_junction ttj_rt ON ttj_rt.tool_id = tr_rt.id
            JOIN tool_resources_junction tdj_rt ON tdj_rt.tool_id = ttj_rt.tool_id AND tdj_rt.active = true
            JOIN resources_resource dr_rt ON dr_rt.id = tdj_rt.resources_id AND dr_rt.active = true
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND dr_rt.resource = ANY(ARRAY['arg_positions','args','args_outputs','bindings','departments','descriptions','domains','flags','names','tools']::resource_type[])
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
            JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            WHERE at.agent_id = a.id AND at.active = true
              AND dr.resource = 'args'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND f_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
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
-- Agent selection for 'args_outputs' resource
args_outputs_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND f.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr_rt ON tr_rt.id = at.tool_id
            JOIN tool_tools_junction ttj_rt ON ttj_rt.tool_id = tr_rt.id
            JOIN tool_resources_junction tdj_rt ON tdj_rt.tool_id = ttj_rt.tool_id AND tdj_rt.active = true
            JOIN resources_resource dr_rt ON dr_rt.id = tdj_rt.resources_id AND dr_rt.active = true
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND dr_rt.resource = ANY(ARRAY['arg_positions','args','args_outputs','bindings','departments','descriptions','domains','flags','names','tools']::resource_type[])
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
            JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            WHERE at.agent_id = a.id AND at.active = true
              AND dr.resource = 'args_outputs'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND f_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
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
            SELECT 1 FROM tool_resources_junction tdj
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            JOIN tool_artifact t ON t.id = tdj.tool_id
            WHERE tdj.active = true
              AND dr.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM tool_resources_junction tdj
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            JOIN tool_artifact t ON t.id = tdj.tool_id
            WHERE tdj.active = true
              AND dr.resource = 'descriptions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM tool_resources_junction tdj
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            JOIN tool_artifact t ON t.id = tdj.tool_id
            WHERE tdj.active = true
              AND dr.resource = 'args'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
        ) as args_has_tools,
        EXISTS (
            SELECT 1 FROM tool_resources_junction tdj
            JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
            JOIN tool_artifact t ON t.id = tdj.tool_id
            WHERE tdj.active = true
              AND dr.resource = 'args_outputs'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
        ) as args_outputs_has_tools
    FROM params x
    LIMIT 1
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            -- names is required
            CASE WHEN NOT tec.names_has_tools AND uf.show_name THEN 'name' ELSE NULL END,
            -- descriptions is optional, so don't check
            -- args is required if show_args is true
            CASE WHEN NOT tec.args_has_tools AND uf.show_args THEN 'args' ELSE NULL END,
            -- args_outputs is required if show_args_outputs is true
            CASE WHEN NOT tec.args_outputs_has_tools AND uf.show_args_outputs THEN 'args_outputs' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
    LIMIT 1
),
permissions_data_with_tools AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    ELSE true  -- Tools can be created by any authenticated user
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN 
                        NULL::text
                    ELSE 
                        'This tool cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    CROSS JOIN user_profile up
    LIMIT 1
),
permissions_final AS (
    SELECT 
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
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    (SELECT tool_exists FROM tool_exists_check) as tool_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,
    -- Tool basic fields
    COALESCE(td.name, '')::text as name,
    COALESCE(td.description, '')::text as description,
    COALESCE(td.active, true)::boolean as active,
    COALESCE(td.updated_at, now())::timestamptz as updated_at,
    -- Single-select resources: name
    nid.names_id,
    COALESCE(
        (SELECT ROW(n.id, n.name, COALESCE(tn.generated, false))::types.q_get_tool_v4_name_resource
         FROM names_resource n
         LEFT JOIN tool_names_junction tn ON tn.names_id = n.id AND tn.tool_id = (SELECT tool_id FROM params)
         WHERE n.id = nid.names_id
         LIMIT 1),
        NULL::types.q_get_tool_v4_name_resource
    ) as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM names_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_tool_v4_name_resource[]) as names,
    -- Single-select resources: description
    did.descriptions_id,
    COALESCE(
        (SELECT ROW(d.id, d.description, COALESCE(td2.generated, false))::types.q_get_tool_v4_description_resource
         FROM descriptions_resource d
         LEFT JOIN tool_descriptions_junction td2 ON td2.descriptions_id = d.id AND td2.tool_id = (SELECT tool_id FROM params)
         WHERE d.id = did.descriptions_id
         LIMIT 1),
        NULL::types.q_get_tool_v4_description_resource
    ) as description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM descriptions_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_tool_v4_description_resource[]) as descriptions,
    -- Domain connections (for scoping logic)
    domids.resource_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.resources_id, dmd.resource, dmd.generated)::types.q_get_tool_v4_domain
            ORDER BY dmd.resources_id
        )
        FROM domain_mapping_data dmd
        WHERE dmd.resources_id = ANY(domids.resource_ids)),
        '{}'::types.q_get_tool_v4_domain[]
    ) as domain_resources,
    -- Multi-select resources: args
    aid.args_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.id, amd.name, amd.description, amd.field_type, amd.required, amd.default_value, amd.position, amd.generated, amd.group_id)::types.q_get_tool_v4_args_resource
            ORDER BY amd.position, amd.name
        )
        FROM args_mapping_data amd
        WHERE amd.id = ANY(aid.args_ids)),
        '{}'::types.q_get_tool_v4_args_resource[]
    ) as args_resources,
    CASE 
        WHEN NOT tec.args_has_tools THEN false
        ELSE uf.show_args
    END as show_args,
    (SELECT agent_id FROM args_agent_data) as args_agent_id,
    CASE 
        WHEN uf.show_args THEN true
        ELSE false
    END as args_required,
    COALESCE((SELECT args_suggestions FROM args_suggestions_data), ARRAY[]::uuid[]) as args_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.id, amd.name, amd.description, amd.field_type, amd.required, amd.default_value, amd.position, amd.generated, amd.group_id)::types.q_get_tool_v4_args_resource
            ORDER BY amd.position, amd.name
        ) FROM (SELECT DISTINCT id, name, description, field_type, required, default_value, position, generated, group_id FROM args_mapping_data) amd),
        '{}'::types.q_get_tool_v4_args_resource[]
    ) as args,
    -- Multi-select resources: args_outputs
    aoid.args_outputs_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (aomd.id, aomd.args_id, aomd.name, aomd.template, aomd.generated, aomd.group_id)::types.q_get_tool_v4_args_outputs_resource
            ORDER BY aomd.name
        )
        FROM args_outputs_mapping_data aomd
        WHERE aomd.id = ANY(aoid.args_outputs_ids)),
        '{}'::types.q_get_tool_v4_args_outputs_resource[]
    ) as args_outputs_resources,
    CASE 
        WHEN NOT tec.args_outputs_has_tools THEN false
        ELSE uf.show_args_outputs
    END as show_args_outputs,
    (SELECT agent_id FROM args_outputs_agent_data) as args_outputs_agent_id,
    CASE 
        WHEN uf.show_args_outputs THEN true
        ELSE false
    END as args_outputs_required,
    COALESCE((SELECT args_outputs_suggestions FROM args_outputs_suggestions_data), ARRAY[]::uuid[]) as args_outputs_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (aomd.id, aomd.args_id, aomd.name, aomd.template, aomd.generated, aomd.group_id)::types.q_get_tool_v4_args_outputs_resource
            ORDER BY aomd.name
        ) FROM (SELECT DISTINCT id, args_id, name, template, generated, group_id FROM args_outputs_mapping_data) aomd),
        '{}'::types.q_get_tool_v4_args_outputs_resource[]
    ) as args_outputs,
    -- Input args fields detail (for Args component - fields from selected args_ids)
    COALESCE((SELECT input_args_fields FROM input_args_fields_data), ARRAY[]::types.q_get_tool_v4_args_field_detail[]) as input_args_fields,
    -- Output args_outputs detail (for ArgsOutputs component - args_outputs from selected args_outputs_ids)
    COALESCE((SELECT output_args_outputs FROM output_args_outputs_data), ARRAY[]::types.q_get_tool_v4_args_outputs_detail[]) as output_args_outputs
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_id_data nid
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_id_data did
CROSS JOIN description_suggestions_data dsd
CROSS JOIN args_ids_data aid
CROSS JOIN args_suggestions_data asd
CROSS JOIN args_outputs_ids_data aoid
CROSS JOIN args_outputs_suggestions_data aosd
CROSS JOIN domain_ids_data domids
CROSS JOIN input_args_fields_data iafd
CROSS JOIN output_args_outputs_data oaod
LEFT JOIN tool_data td ON true
$$;

