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
    field_count integer,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_template AS (
    template_id uuid,
    name text,
    generated boolean
);

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

CREATE TYPE types.q_get_tool_v4_schema_field AS (
    schema_field_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_schema_field_item AS (
    schema_field_item_id uuid,
    schema_field_id uuid,
    schema_field_name text,
    item_schema_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_template_array_item AS (
    template_array_item_id uuid,
    template_id uuid,
    template_name text,
    schema_field_id uuid,
    schema_field_name text,
    item_template_id uuid,
    item_template_name text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_template_value AS (
    template_value_id uuid,
    template_id uuid,
    template_name text,
    schema_field_id uuid,
    schema_field_name text,
    value text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_domain AS (
    domain_id uuid,
    resource text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_schema_field_detail AS (
    schema_field_id uuid,
    schema_id uuid,
    name text,
    field_type text,
    required boolean,
    description text,
    template text,
    position integer,
    default_value text,
    generated boolean
);

CREATE TYPE types.q_get_tool_v4_template_detail AS (
    template_id uuid,
    name text,
    schema_id uuid,
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
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_tool_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_tool_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_tool_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_tool_v4_description_resource[],
    -- Multi-select resources: schemas
    schema_ids uuid[],
    schema_resources types.q_get_tool_v4_schema[],
    show_schemas boolean,
    schemas_agent_id uuid,
    schemas_required boolean,
    schema_suggestions uuid[],
    schemas types.q_get_tool_v4_schema[],
    -- Multi-select resources: schema_fields
    schema_field_ids uuid[],
    schema_field_resources types.q_get_tool_v4_schema_field[],
    show_schema_fields boolean,
    schema_fields_agent_id uuid,
    schema_fields_required boolean,
    schema_field_suggestions uuid[],
    schema_fields types.q_get_tool_v4_schema_field[],
    -- Multi-select resources: schema_field_items
    schema_field_item_ids uuid[],
    schema_field_item_resources types.q_get_tool_v4_schema_field_item[],
    show_schema_field_items boolean,
    schema_field_items_agent_id uuid,
    schema_field_items_required boolean,
    schema_field_item_suggestions uuid[],
    schema_field_items types.q_get_tool_v4_schema_field_item[],
    -- Multi-select resources: templates
    template_ids uuid[],
    template_resources types.q_get_tool_v4_template[],
    show_templates boolean,
    templates_agent_id uuid,
    templates_required boolean,
    template_suggestions uuid[],
    templates types.q_get_tool_v4_template[],
    -- Multi-select resources: template_array_items
    template_array_item_ids uuid[],
    template_array_item_resources types.q_get_tool_v4_template_array_item[],
    show_template_array_items boolean,
    template_array_items_agent_id uuid,
    template_array_items_required boolean,
    template_array_item_suggestions uuid[],
    template_array_items types.q_get_tool_v4_template_array_item[],
    -- Multi-select resources: template_values
    template_value_ids uuid[],
    template_value_resources types.q_get_tool_v4_template_value[],
    show_template_values boolean,
    template_values_agent_id uuid,
    template_values_required boolean,
    template_value_suggestions uuid[],
    template_values types.q_get_tool_v4_template_value[],
    -- Domain connections (for scoping logic)
    domain_ids uuid[],
    domain_resources types.q_get_tool_v4_domain[],
    -- Input schema details (for SchemaInput component)
    input_schema_fields types.q_get_tool_v4_schema_field_detail[],
    -- Output template details (for SchemaOutput component)
    output_templates types.q_get_tool_v4_template_detail[],
    -- Output schema fields (schema_fields from schemas linked to selected templates)
    output_schema_fields types.q_get_tool_v4_schema_field_detail[],
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
    args_outputs types.q_get_tool_v4_args_outputs_resource[]
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
                           AND t.call_id IS NOT NULL
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = t.call_id
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
        COALESCE(
            (SELECT COUNT(*)::integer 
             FROM schema_fields_resource sf 
             WHERE sf.schema_id = s.id AND sf.active = true),
            0
        ) as field_count,
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
        t.name,
        COALESCE(tt.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN templates_resource t ON EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
    LEFT JOIN tool_templates tt ON tt.template_id = t.id AND tt.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all templates for new tools
),
-- Name ID (selected name ID for tool)
name_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT tn.name_id FROM tool_names tn WHERE tn.tool_id = (SELECT tool_id FROM params) LIMIT 1)
        END as name_id
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Name suggestions: linked to tools OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(tn.name_id ORDER BY tn.created_at DESC)
             FROM (
                 SELECT DISTINCT tn.name_id, MAX(tn.created_at) as created_at
                 FROM tool_names tn
                 JOIN names_resource n ON n.id = tn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to tools (tool_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tn.generated = false
                       OR
                       (
                           tn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY tn.name_id
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
    LEFT JOIN tool_names tn ON tn.name_id = n.id AND tn.tool_id = x.tool_id
    WHERE n.name IS NOT NULL AND n.name != ''
),
-- Description ID (selected description ID for tool)
description_id_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN NULL::uuid
            ELSE (SELECT td.description_id FROM tool_descriptions td WHERE td.tool_id = (SELECT tool_id FROM params) LIMIT 1)
        END as description_id
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to tools OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(td.description_id ORDER BY td.created_at DESC)
             FROM (
                 SELECT DISTINCT td.description_id, MAX(td.created_at) as created_at
                 FROM tool_descriptions td
                 JOIN descriptions_resource d ON d.id = td.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE td.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to tools (tool_descriptions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       td.generated = false
                       OR
                       (
                           td.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY td.description_id
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
    LEFT JOIN tool_descriptions td ON td.description_id = d.id AND td.tool_id = x.tool_id
    WHERE d.description IS NOT NULL AND d.description != ''
),
-- Schema field IDs (selected schema field IDs for tool)
schema_field_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tsf.schema_field_id ORDER BY tsf.created_at)
                 FROM tool_schema_fields tsf
                 WHERE tsf.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as schema_field_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Schema field suggestions: linked to tools OR same group with generated=true
schema_field_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(tsf.schema_field_id ORDER BY tsf.created_at DESC)
             FROM (
                 SELECT DISTINCT tsf.schema_field_id, MAX(tsf.created_at) as created_at
                 FROM tool_schema_fields tsf
                 JOIN schema_fields_resource sf ON sf.id = tsf.schema_field_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tsf.schema_field_id IS NOT NULL
                   AND sf.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_schema_fields junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tsf.generated = false
                       OR
                       (
                           tsf.generated = true
                           AND sf.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = sf.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY tsf.schema_field_id
                 ORDER BY MAX(tsf.created_at) DESC
                 LIMIT 20
             ) tsf),
            ARRAY[]::uuid[]
        ) as schema_field_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Schema field mapping (for schema_fields array - all available schema_fields)
schema_field_mapping_data AS (
    SELECT 
        sf.id as schema_field_id,
        sf.name,
        sf.description,
        COALESCE(tsf.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN schema_fields_resource sf ON sf.active = true
    LEFT JOIN tool_schema_fields tsf ON tsf.schema_field_id = sf.id AND tsf.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all schema_fields for new tools
),
-- Schema field item IDs (selected schema field item IDs for tool)
schema_field_item_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tsfi.schema_field_item_id ORDER BY tsfi.created_at)
                 FROM tool_schema_field_items tsfi
                 WHERE tsfi.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as schema_field_item_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Schema field item suggestions: linked to tools OR same group with generated=true
schema_field_item_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(tsfi.schema_field_item_id ORDER BY tsfi.created_at DESC)
             FROM (
                 SELECT DISTINCT tsfi.schema_field_item_id, MAX(tsfi.created_at) as created_at
                 FROM tool_schema_field_items tsfi
                 JOIN schema_field_items_resource sfi ON sfi.id = tsfi.schema_field_item_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tsfi.schema_field_item_id IS NOT NULL
                   AND sfi.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_schema_field_items junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tsfi.generated = false
                       OR
                       (
                           tsfi.generated = true
                           AND sfi.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = sfi.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY tsfi.schema_field_item_id
                 ORDER BY MAX(tsfi.created_at) DESC
                 LIMIT 20
             ) tsfi),
            ARRAY[]::uuid[]
        ) as schema_field_item_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Schema field item mapping (for schema_field_items array - all available schema_field_items)
schema_field_item_mapping_data AS (
    SELECT 
        sfi.id as schema_field_item_id,
        sfi.schema_field_id,
        COALESCE(sf.name, '') as schema_field_name,
        sfi.item_schema_id,
        COALESCE(tsfi.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN schema_field_items_resource sfi ON sfi.active = true
    LEFT JOIN schema_fields_resource sf ON sf.id = sfi.schema_field_id AND sf.active = true
    LEFT JOIN tool_schema_field_items tsfi ON tsfi.schema_field_item_id = sfi.id AND tsfi.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all schema_field_items for new tools
),
-- Template array item IDs (selected template array item IDs for tool)
template_array_item_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ttai.template_array_item_id ORDER BY ttai.created_at)
                 FROM tool_template_array_items ttai
                 WHERE ttai.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as template_array_item_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Template array item suggestions: linked to tools OR same group with generated=true
template_array_item_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ttai.template_array_item_id ORDER BY ttai.created_at DESC)
             FROM (
                 SELECT DISTINCT ttai.template_array_item_id, MAX(ttai.created_at) as created_at
                 FROM tool_template_array_items ttai
                 JOIN template_array_items_resource tai ON tai.id = ttai.template_array_item_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ttai.template_array_item_id IS NOT NULL
                   AND tai.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_template_array_items junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ttai.generated = false
                       OR
                       (
                           ttai.generated = true
                           AND tai.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = tai.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ttai.template_array_item_id
                 ORDER BY MAX(ttai.created_at) DESC
                 LIMIT 20
             ) ttai),
            ARRAY[]::uuid[]
        ) as template_array_item_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Template array item mapping (for template_array_items array - all available template_array_items)
template_array_item_mapping_data AS (
    SELECT 
        tai.id as template_array_item_id,
        tai.template_id,
        COALESCE(t.name, '') as template_name,
        tai.schema_field_id,
        COALESCE(sf.name, '') as schema_field_name,
        tai.item_template_id,
        COALESCE(it.name, '') as item_template_name,
        COALESCE(ttai.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN template_array_items_resource tai ON tai.active = true
    LEFT JOIN templates_resource t ON t.id = tai.template_id
    LEFT JOIN schema_fields_resource sf ON sf.id = tai.schema_field_id AND sf.active = true
    LEFT JOIN templates_resource it ON it.id = tai.item_template_id
    LEFT JOIN tool_template_array_items ttai ON ttai.template_array_item_id = tai.id AND ttai.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all template_array_items for new tools
),
-- Template value IDs (selected template value IDs for tool)
template_value_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ttv.template_value_id ORDER BY ttv.created_at)
                 FROM tool_template_values ttv
                 WHERE ttv.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as template_value_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Template value suggestions: linked to tools OR same group with generated=true
template_value_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ttv.template_value_id ORDER BY ttv.created_at DESC)
             FROM (
                 SELECT DISTINCT ttv.template_value_id, MAX(ttv.created_at) as created_at
                 FROM tool_template_values ttv
                 JOIN template_values_resource tv ON tv.id = ttv.template_value_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ttv.template_value_id IS NOT NULL
                   AND tv.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_template_values junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ttv.generated = false
                       OR
                       (
                           ttv.generated = true
                           AND tv.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = tv.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ttv.template_value_id
                 ORDER BY MAX(ttv.created_at) DESC
                 LIMIT 20
             ) ttv),
            ARRAY[]::uuid[]
        ) as template_value_suggestions
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
                (SELECT ARRAY_AGG(td.domain_id ORDER BY td.created_at)
                 FROM tool_domains td
                 WHERE td.tool_id = (SELECT tool_id FROM params) AND td.active = true),
                ARRAY[]::uuid[]
            )
        END as domain_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Domain mapping (for domain_resources array)
domain_mapping_data AS (
    SELECT 
        d.id as domain_id,
        d.resource::text,
        COALESCE(td.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN domains_resource d ON d.active = true
    LEFT JOIN tool_domains td ON td.domain_id = d.id AND td.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all domains for new tools
),
-- Input schema fields detail (for SchemaInput component - fields from selected schemas)
input_schema_fields_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (sf.id, sf.schema_id, sf.name, sf.field_type::text, sf.required, COALESCE(sf.description, ''), COALESCE(sf.template, ''), sf.position, COALESCE(sf.default_value, ''), COALESCE(sf.generated, false))::types.q_get_tool_v4_schema_field_detail
                ORDER BY sf.position, sf.name
            )
            FROM params x
            CROSS JOIN schema_ids_data sid
            JOIN schema_fields_resource sf ON sf.schema_id = ANY(sid.schema_ids) AND sf.active = true
            WHERE COALESCE(array_length(sid.schema_ids, 1), 0) > 0),
            ARRAY[]::types.q_get_tool_v4_schema_field_detail[]
        ) as input_schema_fields
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Output templates detail (for SchemaOutput component - templates from selected template_ids)
output_templates_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (t.id, t.name, COALESCE(st.schema_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(tt.generated, false))::types.q_get_tool_v4_template_detail
                ORDER BY t.name
            )
            FROM params x
            CROSS JOIN template_ids_data tid
            JOIN templates_resource t ON t.id = ANY(tid.template_ids) AND t.active = true
            LEFT JOIN schema_templates st ON st.template_id = t.id AND st.active = true
            LEFT JOIN tool_templates tt ON tt.template_id = t.id AND tt.tool_id = x.tool_id
            WHERE COALESCE(array_length(tid.template_ids, 1), 0) > 0),
            ARRAY[]::types.q_get_tool_v4_template_detail[]
        ) as output_templates
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Output schema fields detail (for SchemaOutput component - fields from schemas linked to selected templates)
output_schema_fields_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                (sf.id, sf.schema_id, sf.name, sf.field_type::text, sf.required, COALESCE(sf.description, ''), COALESCE(sf.template, ''), sf.position, COALESCE(sf.default_value, ''), COALESCE(sf.generated, false))::types.q_get_tool_v4_schema_field_detail
                ORDER BY sf.position, sf.name
            )
            FROM params x
            CROSS JOIN template_ids_data tid
            JOIN schema_templates st ON st.template_id = ANY(tid.template_ids) AND st.active = true
            JOIN schema_fields_resource sf ON sf.schema_id = st.schema_id AND sf.active = true
            WHERE COALESCE(array_length(tid.template_ids, 1), 0) > 0),
            ARRAY[]::types.q_get_tool_v4_schema_field_detail[]
        ) as output_schema_fields
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Template value mapping (for template_values array - all available template_values)
template_value_mapping_data AS (
    SELECT 
        tv.id as template_value_id,
        tv.template_id,
        COALESCE(t.name, '') as template_name,
        tv.schema_field_id,
        COALESCE(sf.name, '') as schema_field_name,
        COALESCE(
            tv.string_value::text,
            tv.number_value::text,
            tv.boolean_value::text,
            ''
        ) as value,
        COALESCE(ttv.generated, false) as generated
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN template_values_resource tv ON tv.active = true
    LEFT JOIN templates_resource t ON t.id = tv.template_id
    LEFT JOIN schema_fields_resource sf ON sf.id = tv.schema_field_id AND sf.active = true
    LEFT JOIN tool_template_values ttv ON ttv.template_value_id = tv.id AND ttv.tool_id = x.tool_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all template_values for new tools
),
-- Args IDs (selected args IDs for tool)
args_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ta.args_id ORDER BY ta.created_at)
                 FROM tool_args ta
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
                 FROM tool_args ta
                 JOIN args_resource a ON a.id = ta.args_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ta.args_id IS NOT NULL
                   AND a.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_args junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ta.generated = false
                       OR
                       (
                           ta.generated = true
                           AND a.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = a.call_id
                                 AND gr.group_id = dgd.group_id
                           )
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
        a.position,
        COALESCE(ta.generated, false) as generated,
        COALESCE(gr.group_id, NULL::uuid) as group_id
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN args_resource a ON a.active = true
    LEFT JOIN tool_args ta ON ta.args_id = a.id AND ta.tool_id = x.tool_id
    LEFT JOIN calls c ON c.id = a.call_id
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all args for new tools
),
-- Args outputs IDs (selected args_outputs IDs for tool)
args_outputs_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tao.args_outputs_id ORDER BY tao.created_at)
                 FROM tool_args_outputs tao
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
                 FROM tool_args_outputs tao
                 JOIN args_outputs_resource ao ON ao.id = tao.args_outputs_id
                 CROSS JOIN draft_group_data dgd
                 WHERE tao.args_outputs_id IS NOT NULL
                   AND ao.active = true
                   AND (
                       -- Option 1: Linked to tools (tool_args_outputs junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       tao.generated = false
                       OR
                       (
                           tao.generated = true
                           AND ao.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = ao.call_id
                                 AND gr.group_id = dgd.group_id
                           )
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
        COALESCE(gr.group_id, NULL::uuid) as group_id
    FROM params x
    CROSS JOIN draft_group_data dgd
    JOIN args_outputs_resource ao ON ao.active = true
    LEFT JOIN tool_args_outputs tao ON tao.args_outputs_id = ao.id AND tao.tool_id = x.tool_id
    LEFT JOIN calls c ON c.id = ao.call_id
    LEFT JOIN message_calls mc ON mc.call_id = c.id
    LEFT JOIN message_runs mr ON mr.message_id = mc.message_id
    LEFT JOIN group_runs gr ON gr.run_id = mr.run_id
    WHERE x.tool_id IS NOT NULL OR TRUE  -- Include all args_outputs for new tools
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
            WHEN (SELECT COUNT(*) FROM schema_mapping_data) > 0 THEN true
            ELSE false
        END as show_schemas,
        CASE 
            WHEN (SELECT COUNT(*) FROM schema_field_mapping_data) > 0 THEN true
            ELSE false
        END as show_schema_fields,
        CASE 
            WHEN (SELECT COUNT(*) FROM schema_field_item_mapping_data) > 0 THEN true
            ELSE false
        END as show_schema_field_items,
        CASE 
            WHEN (SELECT COUNT(*) FROM template_mapping_data) > 0 THEN true
            ELSE false
        END as show_templates,
        CASE 
            WHEN (SELECT COUNT(*) FROM template_array_item_mapping_data) > 0 THEN true
            ELSE false
        END as show_template_array_items,
        CASE 
            WHEN (SELECT COUNT(*) FROM template_value_mapping_data) > 0 THEN true
            ELSE false
        END as show_template_values,
        CASE 
            WHEN (SELECT COUNT(*) FROM args_mapping_data) > 0 THEN true
            ELSE false
        END as show_args,
        CASE 
            WHEN (SELECT COUNT(*) FROM args_outputs_mapping_data) > 0 THEN true
            ELSE false
        END as show_args_outputs
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
-- Agent selection for 'names' resource
names_agent_data AS (
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
              AND rt.resource = 'names'::resources
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
-- Agent selection for 'descriptions' resource
descriptions_agent_data AS (
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
              AND rt.resource = 'descriptions'::resources
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
-- Agent selection for 'schema_fields' resource
schema_fields_agent_data AS (
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
              AND rt.resource = 'schema_fields'::resources
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
-- Agent selection for 'schema_field_items' resource
schema_field_items_agent_data AS (
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
              AND rt.resource = 'schema_field_items'::resources
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
-- Agent selection for 'template_array_items' resource
template_array_items_agent_data AS (
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
              AND rt.resource = 'template_array_items'::resources
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
-- Agent selection for 'template_values' resource
template_values_agent_data AS (
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
              AND rt.resource = 'template_values'::resources
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
-- Agent selection for 'args' resource
args_agent_data AS (
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
              AND rt.resource = 'args'::resources
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
-- Agent selection for 'args_outputs' resource
args_outputs_agent_data AS (
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
              AND rt.resource = 'args_outputs'::resources
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
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'schemas'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as schemas_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'schema_fields'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as schema_fields_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'schema_field_items'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as schema_field_items_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'templates'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as templates_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'template_array_items'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as template_array_items_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'template_values'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as template_values_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'args'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as args_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'args_outputs'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
        ) as args_outputs_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            -- names is required
            CASE WHEN NOT tec.names_has_tools AND uf.show_name THEN 'name' ELSE NULL END,
            -- descriptions is optional, so don't check
            -- schemas is required if show_schemas is true
            CASE WHEN NOT tec.schemas_has_tools AND uf.show_schemas THEN 'schemas' ELSE NULL END,
            -- schema_fields is required if show_schema_fields is true
            CASE WHEN NOT tec.schema_fields_has_tools AND uf.show_schema_fields THEN 'schema_fields' ELSE NULL END,
            -- schema_field_items is required if show_schema_field_items is true
            CASE WHEN NOT tec.schema_field_items_has_tools AND uf.show_schema_field_items THEN 'schema_field_items' ELSE NULL END,
            -- templates is required if show_templates is true
            CASE WHEN NOT tec.templates_has_tools AND uf.show_templates THEN 'templates' ELSE NULL END,
            -- template_array_items is required if show_template_array_items is true
            CASE WHEN NOT tec.template_array_items_has_tools AND uf.show_template_array_items THEN 'template_array_items' ELSE NULL END,
            -- template_values is required if show_template_values is true
            CASE WHEN NOT tec.template_values_has_tools AND uf.show_template_values THEN 'template_values' ELSE NULL END
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
    -- Single-select resources: name
    nid.name_id,
    COALESCE(
        (SELECT ROW(n.id, n.name, COALESCE(tn.generated, false))::types.q_get_tool_v4_name_resource
         FROM names_resource n
         LEFT JOIN tool_names tn ON tn.name_id = n.id AND tn.tool_id = (SELECT tool_id FROM params)
         WHERE n.id = nid.name_id
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
    COALESCE(
        (SELECT ARRAY_AGG(
            (nmd.id, nmd.name, nmd.generated)::types.q_get_tool_v4_name_resource
            ORDER BY array_position(nsd.name_suggestions, nmd.id)
        ) FROM name_mapping_data nmd
        CROSS JOIN name_suggestions_data nsd),
        '{}'::types.q_get_tool_v4_name_resource[]
    ) as names,
    -- Single-select resources: description
    did.description_id,
    COALESCE(
        (SELECT ROW(d.id, d.description, COALESCE(td2.generated, false))::types.q_get_tool_v4_description_resource
         FROM descriptions_resource d
         LEFT JOIN tool_descriptions td2 ON td2.description_id = d.id AND td2.tool_id = (SELECT tool_id FROM params)
         WHERE d.id = did.description_id
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
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.id, dmd.description, dmd.generated)::types.q_get_tool_v4_description_resource
            ORDER BY array_position(dsd.description_suggestions, dmd.id)
        ) FROM description_mapping_data dmd
        CROSS JOIN description_suggestions_data dsd),
        '{}'::types.q_get_tool_v4_description_resource[]
    ) as descriptions,
    -- Multi-select resources: schemas
    sid.schema_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.schema_id, smd.field_count, smd.generated)::types.q_get_tool_v4_schema
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
            (smd.schema_id, smd.field_count, smd.generated)::types.q_get_tool_v4_schema
            ORDER BY smd.schema_id
        ) FROM (SELECT DISTINCT schema_id, field_count, generated FROM schema_mapping_data) smd),
        '{}'::types.q_get_tool_v4_schema[]
    ) as schemas,
    -- Multi-select resources: schema_fields
    sfid.schema_field_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sfmd.schema_field_id, sfmd.name, sfmd.description, sfmd.generated)::types.q_get_tool_v4_schema_field
            ORDER BY sfmd.schema_field_id
        )
        FROM schema_field_mapping_data sfmd
        WHERE sfmd.schema_field_id = ANY(sfid.schema_field_ids)),
        '{}'::types.q_get_tool_v4_schema_field[]
    ) as schema_field_resources,
    CASE 
        WHEN NOT tec.schema_fields_has_tools THEN false
        ELSE uf.show_schema_fields
    END as show_schema_fields,
    (SELECT agent_id FROM schema_fields_agent_data) as schema_fields_agent_id,
    CASE 
        WHEN uf.show_schema_fields THEN true
        ELSE false
    END as schema_fields_required,
    COALESCE((SELECT schema_field_suggestions FROM schema_field_suggestions_data), ARRAY[]::uuid[]) as schema_field_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sfmd.schema_field_id, sfmd.name, sfmd.description, sfmd.generated)::types.q_get_tool_v4_schema_field
            ORDER BY sfmd.schema_field_id
        ) FROM (SELECT DISTINCT schema_field_id, name, description, generated FROM schema_field_mapping_data) sfmd),
        '{}'::types.q_get_tool_v4_schema_field[]
    ) as schema_fields,
    -- Multi-select resources: schema_field_items
    sfiid.schema_field_item_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sfimd.schema_field_item_id, sfimd.schema_field_id, sfimd.schema_field_name, sfimd.item_schema_id, sfimd.generated)::types.q_get_tool_v4_schema_field_item
            ORDER BY sfimd.schema_field_item_id
        )
        FROM schema_field_item_mapping_data sfimd
        WHERE sfimd.schema_field_item_id = ANY(sfiid.schema_field_item_ids)),
        '{}'::types.q_get_tool_v4_schema_field_item[]
    ) as schema_field_item_resources,
    CASE 
        WHEN NOT tec.schema_field_items_has_tools THEN false
        ELSE uf.show_schema_field_items
    END as show_schema_field_items,
    (SELECT agent_id FROM schema_field_items_agent_data) as schema_field_items_agent_id,
    CASE 
        WHEN uf.show_schema_field_items THEN true
        ELSE false
    END as schema_field_items_required,
    COALESCE((SELECT schema_field_item_suggestions FROM schema_field_item_suggestions_data), ARRAY[]::uuid[]) as schema_field_item_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sfimd.schema_field_item_id, sfimd.schema_field_id, sfimd.schema_field_name, sfimd.item_schema_id, sfimd.generated)::types.q_get_tool_v4_schema_field_item
            ORDER BY sfimd.schema_field_item_id
        ) FROM (SELECT DISTINCT schema_field_item_id, schema_field_id, schema_field_name, item_schema_id, generated FROM schema_field_item_mapping_data) sfimd),
        '{}'::types.q_get_tool_v4_schema_field_item[]
    ) as schema_field_items,
    -- Multi-select resources: templates
    tid.template_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (tmd.template_id, tmd.name, tmd.generated)::types.q_get_tool_v4_template
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
            (tmd.template_id, tmd.name, tmd.generated)::types.q_get_tool_v4_template
            ORDER BY tmd.template_id
        ) FROM (SELECT DISTINCT template_id, name, generated FROM template_mapping_data) tmd),
        '{}'::types.q_get_tool_v4_template[]
    ) as templates,
    -- Multi-select resources: template_array_items
    taiid.template_array_item_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (taimd.template_array_item_id, taimd.template_id, taimd.template_name, taimd.schema_field_id, taimd.schema_field_name, taimd.item_template_id, taimd.item_template_name, taimd.generated)::types.q_get_tool_v4_template_array_item
            ORDER BY taimd.template_array_item_id
        )
        FROM template_array_item_mapping_data taimd
        WHERE taimd.template_array_item_id = ANY(taiid.template_array_item_ids)),
        '{}'::types.q_get_tool_v4_template_array_item[]
    ) as template_array_item_resources,
    CASE 
        WHEN NOT tec.template_array_items_has_tools THEN false
        ELSE uf.show_template_array_items
    END as show_template_array_items,
    (SELECT agent_id FROM template_array_items_agent_data) as template_array_items_agent_id,
    CASE 
        WHEN uf.show_template_array_items THEN true
        ELSE false
    END as template_array_items_required,
    COALESCE((SELECT template_array_item_suggestions FROM template_array_item_suggestions_data), ARRAY[]::uuid[]) as template_array_item_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (taimd.template_array_item_id, taimd.template_id, taimd.template_name, taimd.schema_field_id, taimd.schema_field_name, taimd.item_template_id, taimd.item_template_name, taimd.generated)::types.q_get_tool_v4_template_array_item
            ORDER BY taimd.template_array_item_id
        ) FROM (SELECT DISTINCT template_array_item_id, template_id, template_name, schema_field_id, schema_field_name, item_template_id, item_template_name, generated FROM template_array_item_mapping_data) taimd),
        '{}'::types.q_get_tool_v4_template_array_item[]
    ) as template_array_items,
    -- Multi-select resources: template_values
    tvid.template_value_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (tvmd.template_value_id, tvmd.template_id, tvmd.template_name, tvmd.schema_field_id, tvmd.schema_field_name, tvmd.value, tvmd.generated)::types.q_get_tool_v4_template_value
            ORDER BY tvmd.template_value_id
        )
        FROM template_value_mapping_data tvmd
        WHERE tvmd.template_value_id = ANY(tvid.template_value_ids)),
        '{}'::types.q_get_tool_v4_template_value[]
    ) as template_value_resources,
    CASE 
        WHEN NOT tec.template_values_has_tools THEN false
        ELSE uf.show_template_values
    END as show_template_values,
    (SELECT agent_id FROM template_values_agent_data) as template_values_agent_id,
    CASE 
        WHEN uf.show_template_values THEN true
        ELSE false
    END as template_values_required,
    COALESCE((SELECT template_value_suggestions FROM template_value_suggestions_data), ARRAY[]::uuid[]) as template_value_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (tvmd.template_value_id, tvmd.template_id, tvmd.template_name, tvmd.schema_field_id, tvmd.schema_field_name, tvmd.value, tvmd.generated)::types.q_get_tool_v4_template_value
            ORDER BY tvmd.template_value_id
        ) FROM (SELECT DISTINCT template_value_id, template_id, template_name, schema_field_id, schema_field_name, value, generated FROM template_value_mapping_data) tvmd),
        '{}'::types.q_get_tool_v4_template_value[]
    ) as template_values,
    -- Domain connections (for scoping logic)
    domids.domain_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.domain_id, dmd.resource, dmd.generated)::types.q_get_tool_v4_domain
            ORDER BY dmd.domain_id
        )
        FROM domain_mapping_data dmd
        WHERE dmd.domain_id = ANY(domids.domain_ids)),
        '{}'::types.q_get_tool_v4_domain[]
    ) as domain_resources,
    -- Input schema details (for SchemaInput component)
    COALESCE((SELECT input_schema_fields FROM input_schema_fields_data), ARRAY[]::types.q_get_tool_v4_schema_field_detail[]) as input_schema_fields,
    -- Output template details (for SchemaOutput component)
    COALESCE((SELECT output_templates FROM output_templates_data), ARRAY[]::types.q_get_tool_v4_template_detail[]) as output_templates,
    -- Output schema fields (for SchemaOutput component - Jinja templates in schema_fields)
    COALESCE((SELECT output_schema_fields FROM output_schema_fields_data), ARRAY[]::types.q_get_tool_v4_schema_field_detail[]) as output_schema_fields,
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
    ) as args_outputs
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN name_id_data nid
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_id_data did
CROSS JOIN description_suggestions_data dsd
CROSS JOIN schema_ids_data sid
CROSS JOIN schema_suggestions_data ssd
CROSS JOIN schema_field_ids_data sfid
CROSS JOIN schema_field_suggestions_data sfisd
CROSS JOIN schema_field_item_ids_data sfiid
CROSS JOIN schema_field_item_suggestions_data sfiisd
CROSS JOIN template_ids_data tid
CROSS JOIN template_suggestions_data tsd
CROSS JOIN template_array_item_ids_data taiid
CROSS JOIN template_array_item_suggestions_data taiisd
CROSS JOIN template_value_ids_data tvid
CROSS JOIN template_value_suggestions_data tvisd
CROSS JOIN args_ids_data aid
CROSS JOIN args_suggestions_data asd
CROSS JOIN args_outputs_ids_data aoid
CROSS JOIN args_outputs_suggestions_data aosd
CROSS JOIN domain_ids_data domids
CROSS JOIN input_schema_fields_data isfd
CROSS JOIN output_templates_data otd
CROSS JOIN output_schema_fields_data osfd
LEFT JOIN tool_data td ON true
$$;
