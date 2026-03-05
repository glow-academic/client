-- Get all data needed to run text generation agent for existing run
-- Takes run_id and returns full context (agent config, tools, messages_entry, etc.)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- NOTE: The type i_get_text_run_context_and_create_run_v4_tool is already defined in
-- get_text_run_context_and_create_run_complete.sql and reused here
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
    func_sig text;
BEGIN
    FOR r IN 
        SELECT oid
        FROM pg_proc 
        WHERE proname = 'socket_get_text_run_context_for_existing_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        BEGIN
            -- Try to get signature, but handle missing types gracefully
            SELECT pg_get_function_identity_arguments(r.oid) INTO func_sig;
            EXECUTE format('DROP FUNCTION IF EXISTS socket_get_text_run_context_for_existing_run_v4(%s)', func_sig);
        EXCEPTION WHEN OTHERS THEN
            -- Function might reference missing types, try dropping by OID with CASCADE
            BEGIN
                EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.oid::regprocedure);
            EXCEPTION WHEN OTHERS THEN
                NULL; -- Ignore errors if function doesn't exist or can't be dropped
            END;
        END;
    END LOOP;
END $$;

-- 2) Recreate function
-- Takes run_id and returns full context for agent execution
CREATE OR REPLACE FUNCTION socket_get_text_run_context_for_existing_run_v4(
    run_id uuid,
    agent_id uuid,
    message_ids uuid[] DEFAULT NULL,  -- Includes user regeneration message (if created) + context messages_entry
    group_id uuid DEFAULT NULL,
    resources types.i_persona_resource_v4[] DEFAULT NULL  -- Optional: array of (resource_type, resource_ids) for fetching whitelisted resources
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    agent_role text,
    system_prompt text,
    temperature float,
    reasoning text,
    model_id text,
    model_name text,
    provider text,
    base_url text,
    api_key text,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    group_id uuid,
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    developer_instruction_templates text[],  -- Changed to array
    context jsonb,  -- Added: whitelisted resources for Jinja templating
    department_name text,
    upload_id uuid,
    file_path text,
    mime_type text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        run_id AS run_id,
        agent_id AS agent_id,
        message_ids AS message_ids,
        group_id AS group_id,
        resources AS resources
),
-- Validate run exists
existing_run AS (
    SELECT
        r.id as run_id,
        COALESCE(r.group_id, p.group_id) as group_id
    FROM runs_entry r
    CROSS JOIN params p
    WHERE r.id = p.run_id
    LIMIT 1
),
-- Get group_id
group_data AS (
    SELECT
        er.group_id
    FROM existing_run er
),
-- Get agent
selected_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flags_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND f.value = true)
    LIMIT 1
),
-- Get profile FROM runs_entry
run_profile AS (
    SELECT prj.profiles_id as profile_id
    FROM runs_entry r
    JOIN profiles_runs_connection prj ON prj.run_id = r.id
    CROSS JOIN params p
    WHERE r.id = p.run_id
    LIMIT 1
),
-- Get rate limit info (for display, not validation)
profile_rate_limit AS (
    SELECT 
        rl.requests_per_day as req_per_day
    FROM run_profile rp
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = rp.profile_id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limits_id = rl.id
),
runs_today AS (
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs_entry mr
    JOIN profiles_runs_connection prj2 ON prj2.run_id = mr.id
    CROSS JOIN run_profile rp
    WHERE prj2.profiles_id = rp.profile_id
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get profile's primary department for department name resolution
profile_primary_department AS (
    SELECT pd.departments_id
    FROM run_profile rp
    JOIN profile_departments_junction pd ON pd.profile_id = rp.profile_id
    WHERE pd.is_primary = TRUE
      AND pd.active = true
    LIMIT 1
),
-- Build tool arguments FROM args_resource (replaces schemas_resource)
tool_schema_data AS (
    SELECT 
        t.id as tool_id,
        ta.args_id as schema_id,  -- Using args_id as schema_id for backward compatibility
        -- Build arguments JSONB FROM args_resource
        COALESCE(
            jsonb_object_agg(
                ar.name,
                jsonb_build_object(
                    'type', CASE ar.field_type
                        WHEN 'string' THEN 'string'
                        WHEN 'number' THEN 'number'
                        WHEN 'boolean' THEN 'boolean'
                        WHEN 'array' THEN 'array'
                        ELSE 'string'
                    END,
                    'required', ar.required
                )
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        -- Build argument_descriptions JSONB FROM args_resource.description
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
        -- Build argument_defaults JSONB FROM args_resource.default_value
        COALESCE(
            jsonb_object_agg(
                ar.name,
                CASE 
                    WHEN ar.default_value = '' THEN NULL
                    WHEN ar.field_type = 'number' THEN 
                        CASE 
                            WHEN ar.default_value ~ '^-?[0-9]+\.?[0-9]*$' THEN to_jsonb(ar.default_value::numeric)
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'boolean' THEN 
                        CASE 
                            WHEN LOWER(ar.default_value) IN ('true', '1', 'yes') THEN 'true'::jsonb
                            WHEN LOWER(ar.default_value) IN ('false', '0', 'no') THEN 'false'::jsonb
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'array' THEN 
                        CASE 
                            WHEN ar.default_value ~ '^\[.*\]$' THEN ar.default_value::jsonb
                            ELSE NULL
                        END
                    ELSE ar.default_value::jsonb
                END
                ORDER BY ar.name
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool_artifact t
    LEFT JOIN tool_args_junction ta ON ta.tool_id = t.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    GROUP BY t.id, ta.args_id
),
-- Get agent tools as composite type array
-- Filter tools to only include those matching the resource_type parameter
-- Include tools where dr.resource matches resource_type OR dr.resource IS NULL (global tools)
agent_tools_data AS (
    SELECT 
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.names_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.descriptions_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(dr.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flags_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(dr.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.names_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
            ) FILTER (WHERE t.id IS NOT NULL AND (
                p.resources IS NULL  -- Backward compatibility: include all tools
                OR dr.resource IS NULL  -- Global tools always included
                OR EXISTS (
                    SELECT 1 FROM unnest(p.resources) AS r
                    WHERE dr.resource::text = r.resource_type
                )
            )),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM selected_agent sa
    CROSS JOIN params p
    LEFT JOIN agent_tools_junction at ON at.agent_id = sa.agent_id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tools_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tool_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flags_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    LEFT JOIN tool_resources_junction tdj ON tdj.tool_id = t.id AND tdj.active = true
    LEFT JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true


    GROUP BY sa.agent_id
),
-- Get developer instruction templates (array) for the agent
developer_instruction_data AS (
    SELECT 
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(i.template ORDER BY i.created_at),
            ARRAY[]::text[]
        ) as developer_instruction_templates
    FROM selected_agent sa
    INNER JOIN agents_resource a ON a.id = sa.agent_id
    LEFT JOIN LATERAL UNNEST(COALESCE(a.instruction_ids, ARRAY[]::uuid[])) AS iid ON true
    LEFT JOIN instructions_resource i ON i.id = iid AND i.active = true
    GROUP BY sa.agent_id
),
-- Fetch whitelisted resources based on resource_ids (if provided)
-- Reuse the same pattern as get_text_run_context_and_create_run
names_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', n.id::text,
                    'name', n.name
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS names_id
    JOIN names_resource n ON n.id = names_id
    WHERE r.resource_type = 'names'
),
descriptions_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'description', d.description
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS desc_id
    JOIN descriptions_resource d ON d.id = desc_id
    WHERE r.resource_type = 'descriptions'
),
colors_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', c.id::text,
                    'name', c.name,
                    'description', c.description,
                    'hex_code', c.hex_code
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS color_id
    JOIN colors_resource c ON c.id = color_id
    WHERE r.resource_type = 'colors'
),
icons_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', i.id::text,
                    'name', i.name,
                    'description', i.description,
                    'value', i.value
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS icon_id
    JOIN icons_resource i ON i.id = icon_id
    WHERE r.resource_type = 'icons'
),
instructions_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', inst.id::text,
                    'template', inst.template
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS inst_id
    JOIN instructions_resource inst ON inst.id = inst_id
    WHERE r.resource_type = 'instructions'
),
flags_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'name', f.name,
                    'description', f.description
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS flag_id
    JOIN flags_resource f ON f.id = flag_id
    WHERE r.resource_type = 'flags'
),
departments_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'name', (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.department_id = d.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM department_descriptions_junction dd JOIN descriptions_resource desc_data ON dd.descriptions_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS dept_id
    JOIN departments_resource d ON d.id = dept_id
    WHERE r.resource_type = 'departments'
),
fields_resources AS (
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', ffj.field_id::text,
                    'name', (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.names_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
                    'description', (SELECT desc_data.description FROM field_descriptions_junction fd JOIN descriptions_resource desc_data ON fd.descriptions_id = desc_data.id WHERE fd.field_id = ffj.field_id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS field_id_val
    JOIN fields_resource f ON f.id = field_id_val
    JOIN field_fields_junction ffj ON ffj.fields_id = f.id
    WHERE r.resource_type = 'fields'
),
examples_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', e.id::text,
                    'example', e.example
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS examples_id
    JOIN examples_resource e ON e.id = examples_id
    WHERE r.resource_type = 'examples'
),
-- Combine all resources into single JSONB object
combined_resources AS (
    SELECT 
        jsonb_build_object(
            'names', COALESCE((SELECT resources FROM names_resources), '[]'::jsonb),
            'descriptions', COALESCE((SELECT resources FROM descriptions_resources), '[]'::jsonb),
            'colors', COALESCE((SELECT resources FROM colors_resources), '[]'::jsonb),
            'icons', COALESCE((SELECT resources FROM icons_resources), '[]'::jsonb),
            'instructions', COALESCE((SELECT resources FROM instructions_resources), '[]'::jsonb),
            'flags', COALESCE((SELECT resources FROM flags_resources), '[]'::jsonb),
            'departments', COALESCE((SELECT resources FROM departments_resources), '[]'::jsonb),
            'fields', COALESCE((SELECT resources FROM fields_resources), '[]'::jsonb),
            'examples', COALESCE((SELECT resources FROM examples_resources), '[]'::jsonb)
        ) as context
),
-- Get department name (from agent_departments_junction or profile primary department)
department_data AS (
    SELECT 
        COALESCE(
            (SELECT ad.departments_id FROM agent_departments_junction ad 
             JOIN selected_agent sa ON NULL::uuid = sa.agent_id 
             WHERE ad.active = true LIMIT 1),
            (SELECT ppd.departments_id FROM profile_primary_department ppd)
        ) as department_id
),
department_name_data AS (
    SELECT (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.department_id = d.id LIMIT 1) as department_name
    FROM department_data dd
    LEFT JOIN departments_resource d ON d.id = dd.department_id
),
-- Get upload info if exists (for audio input) - get FROM messages_entry linked to run
upload_info AS (
    SELECT DISTINCT
        u.id as upload_id,
        u.file_path,
        u.mime_type
    FROM params p
    JOIN messages_entry m ON m.run_id = p.run_id
    JOIN message_uploads_entry mue ON mue.message_id = m.id AND mue.active = true
    JOIN uploads_entry u ON u.id = mue.upload_id AND u.active = true
    JOIN audio_uploads_entry aue ON aue.upload_id = u.id AND aue.active = true
    LIMIT 1
),
-- Context data with agent config
context_data AS (
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.names_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(NULL::artifact_type::text, '') as agent_role,  -- Derive from domain_artifacts via agent_domains
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,  -- Don't append developer instructions here - Python will handle it
        COALESCE(a.temperature, 0.0) as temperature,
        a.reasoning as reasoning,

        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(pr_prov_res.endpoint, '') as base_url,
        pr_prov_res.key as api_key,
        
        -- Profile data
        rp.profile_id::text as profile_id,
        
        -- Rate limit data (for display)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,
        
        -- Developer instruction templates (array)
        COALESCE(did.developer_instruction_templates, ARRAY[]::text[]) as developer_instruction_templates,
        
        -- Context (whitelisted resources for Jinja templating)
        COALESCE(cr.context, '{}'::jsonb) as context,
        
        -- Department data
        dnd.department_name

    FROM selected_agent sa
    INNER JOIN agents_resource a ON a.id = sa.agent_id
    
    
    CROSS JOIN run_profile rp
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = a.prompt_id
    INNER JOIN models_resource m ON m.id = a.model_id
    -- Get provider via models_resource.provider_id
    LEFT JOIN providers_resource pr_prov_res ON pr_prov_res.id = m.provider_id
    LEFT JOIN provider_providers_junction ppj_prov ON ppj_prov.providers_id = pr_prov_res.id AND ppj_prov.active = true
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = ppj_prov.provider_id
    LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.names_id
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- JOIN tools_resource data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
    -- Join context (whitelisted resources)
    CROSS JOIN combined_resources cr
    -- JOIN department_artifact data
    CROSS JOIN department_name_data dnd
)
SELECT 
    -- Context data
    cd.agent_id,
    cd.agent_name,
    cd.agent_role,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Group ID
    gd.group_id,
    -- Tools array
    cd.tools,
    -- Developer instruction templates (array)
    cd.developer_instruction_templates,
    -- Context (whitelisted resources for Jinja templating)
    cd.context,
    -- Department name
    cd.department_name,
    -- Upload info (for audio input, when upload_id is provided)
    ui.upload_id,
    ui.file_path,
    ui.mime_type
FROM context_data cd
CROSS JOIN existing_run er
CROSS JOIN group_data gd
LEFT JOIN upload_info ui ON true
$$;
