-- Get all data needed to run document agent AND create run in single atomic transaction
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_document_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_document_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_get_document_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for pass-through parameters (not used in SQL, but needed in ApiRequest)
CREATE TYPE types.i_get_document_run_context_and_create_run_v4_pass_through AS (
    document_id uuid,
    document_name text,
    document_description text,
    field_ids uuid[]
);

-- 4) Create composite types for tools and fields arrays
CREATE TYPE types.i_get_document_run_context_and_create_run_v4_tool AS (
    id uuid,
    name text,
    description text,
    tool_type text,
    agent_role text,
    arguments jsonb,
    argument_descriptions jsonb,
    argument_defaults jsonb,
    active boolean
);

CREATE TYPE types.i_get_document_run_context_and_create_run_v4_field AS (
    item_name text,
    item_description text,
    param_name text,
    param_description text
);

-- 5) Recreate function
-- Note: document_id, document_name, document_description, field_ids are pass-through parameters (not used in SQL)
-- They are included so they appear in the auto-generated ApiRequest type
CREATE OR REPLACE FUNCTION socket_get_document_run_context_and_create_run_v4(
    department_id uuid,
    profile_id uuid,
    document_id uuid DEFAULT NULL,
    document_name text DEFAULT NULL,
    document_description text DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL
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
    run_id text,
    group_id uuid,
    trace_id text,
    tools types.i_get_document_run_context_and_create_run_v4_tool[],
    developer_instruction_template text,
    developer_instruction_schema_id uuid,
    department_name text,
    template_context_fields types.i_get_document_run_context_and_create_run_v4_field[],
    developer_message_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id, 
        profile_id AS profile_id,
        document_id AS document_id,
        document_name AS document_name,
        document_description AS document_description,
        field_ids AS field_ids
),
create_group_if_needed AS (
    -- Create new group if group_id is NULL (always NULL for first generation)
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = socket_get_document_run_context_and_create_run_v4.profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
    FROM params p
    WHERE p.department_id IS NOT NULL  -- Always create group for document generation
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use newly created group
    SELECT 
        cg.group_id,
        cg.trace_id
    FROM create_group_if_needed cg
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    
    
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN params p
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = p.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = p.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        rl.requests_per_day as req_per_day
    FROM profile_artifact prof
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE prof.id = (SELECT profile_id FROM params)
),
runs_today AS (
    -- Count model view_runs_entry for the profile since start of day
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM profile_runs_junction prj
    JOIN view_runs_entry mr ON mr.id = prj.run_id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys_junction)
-- Use profile's primary department for settings resolution
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments_junction pd
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id
      AND pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys_junction spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND kr.active
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings_junction sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings_junction sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT s.id FROM setting_artifact s WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = true) LIMIT 1)
        ) as settings_id
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
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        -- Build argument_descriptions JSONB FROM args_resource.description
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.position
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
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool_artifact t
    LEFT JOIN tool_args_junction ta ON ta.tool_id = t.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    GROUP BY t.id, ta.args_id
),
-- Get agent tools as composite type array
agent_tools_data AS (
    SELECT 
        ba.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(rt.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_document_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
            ) FILTER (WHERE t.id IS NOT NULL),
            '{}'::types.i_get_document_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM best_agent ba
    LEFT JOIN agent_tools_junction at ON at.agent_id = ba.agent_id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    
    
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    GROUP BY ba.agent_id
),
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        ba.agent_id,
        i.template as developer_instruction_template,
        NULL::uuid as developer_instruction_schema_id
    FROM best_agent ba
    INNER JOIN agents_resource a ON a.id = ba.agent_id
    -- JOIN instructions_resource via agent_instructions_junction (following {strong}_{weak} pattern)
    LEFT JOIN agent_instructions_junction ai ON ai.agent_id = a.id
    LEFT JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
    LIMIT 1
),
-- Get department name
department_data AS (
    SELECT 
        p.department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as department_name
    FROM params p
    LEFT JOIN departments_resource d ON d.id = p.department_id
),
-- Get template context fields (if field_ids provided)
template_context_fields_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                ((SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1), COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), ''), (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pa.id LIMIT 1), COALESCE((SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = pa.id LIMIT 1), ''))::types.i_get_document_run_context_and_create_run_v4_field
                ORDER BY array_position(p.field_ids, f.id)
            ),
            '{}'::types.i_get_document_run_context_and_create_run_v4_field[]
        ) as template_context_fields
    FROM params p
    LEFT JOIN fields_resource f ON f.id = ANY(p.field_ids) AND p.field_ids IS NOT NULL AND array_length(p.field_ids, 1) > 0
    LEFT JOIN field_fields_junction ffj ON ffj.fields_id = f.id
    LEFT JOIN parameters_resource pa ON pa.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_resource_id = f.id LIMIT 1) AND EXISTS (SELECT 1 FROM parameter_flags_junction paf JOIN flags_resource fl ON paf.flag_id = fl.id WHERE paf.parameter_id = pa.id AND fl.name = 'parameter_active' AND paf.value = true)
    WHERE p.field_ids IS NOT NULL AND array_length(p.field_ids, 1) > 0
    GROUP BY p.field_ids
    UNION ALL
    -- Return empty array if no field_ids provided
    SELECT '{}'::types.i_get_document_run_context_and_create_run_v4_field[] as template_context_fields
    FROM params p
    WHERE p.field_ids IS NULL OR array_length(p.field_ids, 1) IS NULL OR array_length(p.field_ids, 1) = 0
    LIMIT 1
),
context_data AS (
    -- Get all context data (agent, model, provider, etc.)
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(NULL::artifact_type::text, '') as agent_role,  -- Derive from domain_artifacts via agent_domains
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,
        
        -- Profile data
        p.profile_id::text as profile_id,
        
        -- Rate limit data (for profile)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_document_run_context_and_create_run_v4_tool[]) as tools,
        
        -- Developer instruction data
        did.developer_instruction_template,
        did.developer_instruction_schema_id,
        
        -- Department data
        dd.department_name,
        
        -- Template context fields
        COALESCE(tcfd.template_context_fields, '{}'::types.i_get_document_run_context_and_create_run_v4_field[]) as template_context_fields

    FROM best_agent ba
    INNER JOIN agents_resource a ON a.id = ba.agent_id
    
    
    CROSS JOIN params p
    LEFT JOIN agent_prompts_junction ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ap_default.prompt_id
    INNER JOIN agent_models_junction am ON am.agent_id = a.id
    INNER JOIN models_resource m ON m.id = am.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels_junction atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels_junction mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
    LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    -- Join reasoning from junction table
    -- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
    LEFT JOIN agent_reasoning_levels_junction arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels_junction mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
    LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
    LEFT JOIN model_endpoints_junction me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys_junction
    LEFT JOIN model_providers_junction mp ON mp.model_id = m.id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = p_prov.id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = ppj.provider_id
    LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys_junction spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- JOIN tools_resource data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = ba.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = ba.agent_id
    -- JOIN department_artifact data
    LEFT JOIN department_data dd ON dd.department_id = p.department_id
    -- Join template context fields data
    LEFT JOIN template_context_fields_data tcfd ON true
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
create_run AS (
    -- Create run record with group_id directly
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id)
    SELECT 0, 0, gd.group_id
    FROM context_data cd
    CROSS JOIN group_data gd
    RETURNING id
),
link_run_agent AS (
    -- Link run to agent via junction table
    INSERT INTO agent_runs_junction (agent_id, run_id)
    SELECT cd.agent_id::uuid, cr.id
    FROM context_data cd
    CROSS JOIN create_run cr
),
link_run_to_profile AS (
    -- Link run to profile via junction table
    INSERT INTO profile_runs_junction (profile_id, run_id)
    SELECT cd.profile_id::uuid, cr.id
    FROM context_data cd
    CROSS JOIN create_run cr
    WHERE cd.profile_id IS NOT NULL
),
link_group AS (
    -- Dummy CTE to maintain compatibility (view_runs_entry now have group_id directly)
    SELECT cr.id as run_id
    FROM create_run cr
),
-- Create and link developer message if template exists
developer_message_content AS (
    SELECT 
        cd.developer_instruction_template as content,
        lg.run_id
    FROM context_data cd
    CROSS JOIN link_group lg
    WHERE cd.developer_instruction_template IS NOT NULL
    LIMIT 1
),
developer_message_hash AS (
    SELECT 
        dmc.content,
        dmc.run_id,
        message_content_hash(dmc.content, 'developer') as hash
    FROM developer_message_content dmc
),
existing_developer_message AS (
    SELECT
        m.id,
        m.created_at,
        dmh.run_id
    FROM view_messages_entry m
    JOIN LATERAL (
        SELECT content
        FROM simulation_contents_entry ce
        WHERE ce.message_id = m.id
          AND ce.active = true
        ORDER BY ce.created_at
        LIMIT 1
    ) ce ON TRUE
    JOIN developer_message_hash dmh ON message_content_hash(ce.content, 'developer') = dmh.hash
    WHERE m.role = 'developer'
    LIMIT 1
),
new_developer_message AS (
    INSERT INTO messages_entry (role, completed, audio, run_id, created_at, updated_at)
    SELECT 'developer'::message_type, false, false, (SELECT run_id FROM developer_message_hash LIMIT 1), NOW(), NOW()
    FROM developer_message_hash dmh
    WHERE NOT EXISTS (SELECT 1 FROM existing_developer_message)
    RETURNING id, created_at, updated_at
),
insert_developer_content AS (
    INSERT INTO simulation_contents_entry (message_id, content, created_at, updated_at)
    SELECT
        nm.id,
        (SELECT content FROM developer_message_hash LIMIT 1),
        nm.created_at,
        nm.updated_at
    FROM new_developer_message nm
    WHERE EXISTS (SELECT 1 FROM developer_message_content)
),
developer_message_final AS (
    SELECT id, run_id FROM existing_developer_message
    UNION ALL
    SELECT
        nm.id,
        (SELECT run_id FROM developer_message_hash LIMIT 1) as run_id
    FROM new_developer_message nm
),
update_existing_developer_message_run AS (
    UPDATE messages_entry m
    SET run_id = edm.run_id, updated_at = NOW()
    FROM existing_developer_message edm
    WHERE m.id = edm.id AND edm.run_id IS NOT NULL
    RETURNING m.id as message_id, m.run_id
),
link_developer_message_to_run AS (
    -- Combine existing (updated) and new developer view_messages_entry
    SELECT message_id, run_id FROM update_existing_developer_message_run
    UNION ALL
    SELECT nm.id as message_id, (SELECT run_id FROM developer_message_hash LIMIT 1) as run_id
    FROM new_developer_message nm
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
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Group ID and trace_id (from view_groups_entry table)
    gd.group_id,
    gd.trace_id::text as trace_id,
    -- Tools array
    cd.tools,
    -- Developer instruction
    cd.developer_instruction_template,
    cd.developer_instruction_schema_id,
    -- Department name
    cd.department_name,
    -- Template context fields
    cd.template_context_fields,
    -- Developer message ID (if created/linked)
    ldm.message_id as developer_message_id
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
LEFT JOIN link_developer_message_to_run ldm ON true
$$;
