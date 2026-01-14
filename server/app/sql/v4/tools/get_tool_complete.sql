-- Unified get tool function - handles both new (tool_id = NULL) and detail (tool_id provided)
-- Converted to function with composite types
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

-- 3) Recreate types
CREATE TYPE types.q_get_tool_v4_schema AS (
    schema_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_template AS (
    template_id uuid,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_tool_v4(
    profile_id uuid,
    tool_id uuid DEFAULT NULL,
    schema_search text DEFAULT NULL,
    template_search text DEFAULT NULL,
    schema_show_selected boolean DEFAULT NULL,
    template_show_selected boolean DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    tool_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Tool basic fields (FROM tool_artifact table)
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    -- Multi-select resources: schemas
    schema_ids uuid[],
    schema_resources types.q_get_tool_v4_schema[],
    show_schemas boolean,
    schemas_agent_id uuid,
    schemas_required boolean,
    schema_suggestions uuid[],
    schemas types.q_get_tool_v4_schema[],
    -- Multi-select resources: templates
    template_ids uuid[],
    template_resources types.q_get_tool_v4_template[],
    show_templates boolean,
    templates_agent_id uuid,
    templates_required boolean,
    template_suggestions uuid[],
    templates types.q_get_tool_v4_template[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        tool_id AS tool_id,
        profile_id AS profile_id,
        schema_search AS schema_search,
        template_search AS template_search,
        COALESCE(schema_show_selected, false) AS schema_show_selected,
        COALESCE(template_show_selected, false) AS template_show_selected,
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
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
-- Tool data (FROM tool_artifact table)
tool_data AS (
    SELECT 
        t.id,
        (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        (SELECT d.description FROM tool_descriptions td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true) as active,
        t.updated_at
    FROM params x
    LEFT JOIN tool_artifact t ON t.id = x.tool_id
    WHERE x.tool_id IS NOT NULL
    LIMIT 1
),
-- Schema IDs (selected schema IDs for tool)
schema_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ts.schema_id ORDER BY ts.created_at)
                 FROM tool_schemas ts
                 WHERE ts.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as schema_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Template IDs (selected template IDs for tool)
template_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tt.template_id ORDER BY tt.created_at)
                 FROM tool_templates tt
                 WHERE tt.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as template_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Schema suggestions: linked to tools OR same group with generated=true
schema_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ts.schema_id ORDER BY ts.created_at DESC)
             FROM (
                 SELECT DISTINCT ts.schema_id, MAX(ts.created_at) as created_at
                 FROM tool_schemas ts
                 JOIN schemas_resource s ON s.id = ts.schema_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ts.schema_id IS NOT NULL
                   AND s.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_schemas junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ts.generated = false
                       OR
                       (
                           ts.generated = true
                           AND s.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = s.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ts.schema_id
                 ORDER BY MAX(ts.created_at) DESC
                 LIMIT 20
             ) ts),
            ARRAY[]::uuid[]
        ) as schema_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Template suggestions: linked to tools OR same group with generated=true
template_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(tt.template_id ORDER BY tt.created_at DESC)
             FROM (
                 SELECT DISTINCT tt.template_id, MAX(tt.created_at) as created_at
                 FROM tool_templates tt
                 JOIN templates_resource t ON t.id = tt.template_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tt.template_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
                   AND (
                       -- Option 1: Linked to tools (tool_templates junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tt.generated = false
                       OR
                       (
                           tt.generated = true
                           AND t.generated = true
                           AND tt.call_id IS NOT NULL
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = tt.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY tt.template_id
                 ORDER BY MAX(tt.created_at) DESC
                 LIMIT 20
             ) tt),
            ARRAY[]::uuid[]
        ) as template_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Schema mapping (for schemas array - all available schemas)
schema_mapping_data AS (
    SELECT 
        s.id as schema_id,
        COALESCE(ts.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN schemas_resource s ON s.active = true
    LEFT JOIN tool_schemas ts ON ts.schema_id = s.id AND ts.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all schemas for new tools
),
-- Template mapping (for templates array - all available templates)
template_mapping_data AS (
    SELECT 
        t.id as template_id,
        COALESCE(tt.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN templates_resource t ON EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
    LEFT JOIN tool_templates tt ON tt.template_id = t.id AND tt.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all templates for new tools
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM schema_mapping_data) > 0 THEN true
            ELSE false
        END as show_schemas,
        CASE 
            WHEN (SELECT COUNT(*) FROM template_mapping_data) > 0 THEN true
            ELSE false
        END as show_templates
    FROM params x
),
-- Agent selection helper CTEs (shared across all agent selections)
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        (SELECT department_id FROM profile_primary_department_for_agents) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Agent selection for 'schemas' resource
schemas_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'tool'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'schemas'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
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
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'templates' resource
templates_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af WHERE af.agent_id = a.id AND af.type = 'active'::type_agent_flags 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifacts = 'tool'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'templates'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                WHERE af_mcp.agent_id = a.id
                  AND af_mcp.type = 'mcp'::type_agent_flags
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
                         WHERE NULL::uuid = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
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
            WHERE rt.resource = 'schemas'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as schemas_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'templates'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as templates_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.schemas_has_tools AND uf.show_schemas THEN 'schemas' ELSE NULL END,
            CASE WHEN NOT tec.templates_has_tools AND uf.show_templates THEN 'templates' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
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
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
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
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This tool cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    CROSS JOIN user_profile up
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
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT tool_exists FROM tool_exists_check) as tool_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Tool basic fields
    COALESCE(td.name, '')::text as name,
    COALESCE(td.description, '')::text as description,
    COALESCE(td.active, true)::boolean as active,
    COALESCE(td.updated_at, now())::timestamptz as updated_at,
    -- Multi-select resources: schemas
    sid.schema_ids,
    -- Schema resources (selected schemas filtered by schema_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.schema_id, smd.generated)::types.q_get_tool_v4_schema
            ORDER BY smd.schema_id
        )
        FROM schema_mapping_data smd
        WHERE smd.schema_id = ANY(sid.schema_ids)),
        '{}'::types.q_get_tool_v4_schema[]
    ) as schema_resources,
    CASE 
        WHEN NOT tec.schemas_has_tools THEN false
        ELSE uf.show_schemas
    END as show_schemas,
    (SELECT agent_id FROM schemas_agent_data) as schemas_agent_id,
    CASE 
        WHEN uf.show_schemas THEN true
        ELSE false
    END as schemas_required,
    COALESCE((SELECT schema_suggestions FROM schema_suggestions_data), ARRAY[]::uuid[]) as schema_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.schema_id, smd.generated)::types.q_get_tool_v4_schema
            ORDER BY smd.schema_id
        ) FROM (SELECT DISTINCT schema_id, generated FROM schema_mapping_data) smd),
        '{}'::types.q_get_tool_v4_schema[]
    ) as schemas,
    -- Multi-select resources: templates
    tid.template_ids,
    -- Template resources (selected templates filtered by template_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (tmd.template_id, tmd.generated)::types.q_get_tool_v4_template
            ORDER BY tmd.template_id
        )
        FROM template_mapping_data tmd
        WHERE tmd.template_id = ANY(tid.template_ids)),
        '{}'::types.q_get_tool_v4_template[]
    ) as template_resources,
    CASE 
        WHEN NOT tec.templates_has_tools THEN false
        ELSE uf.show_templates
    END as show_templates,
    (SELECT agent_id FROM templates_agent_data) as templates_agent_id,
    CASE 
        WHEN uf.show_templates THEN true
        ELSE false
    END as templates_required,
    COALESCE((SELECT template_suggestions FROM template_suggestions_data), ARRAY[]::uuid[]) as template_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (tmd.template_id, tmd.generated)::types.q_get_tool_v4_template
            ORDER BY tmd.template_id
        ) FROM (SELECT DISTINCT template_id, generated FROM template_mapping_data) tmd),
        '{}'::types.q_get_tool_v4_template[]
    ) as templates
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN schema_ids_data sid
CROSS JOIN template_ids_data tid
CROSS JOIN schema_suggestions_data ssd
CROSS JOIN template_suggestions_data tsd
LEFT JOIN tool_data td ON true
$$;
