-- Get all data needed to run text generation agent AND create run in single atomic transaction
-- Generic version that works with any agent_id and resource
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- NOTE: The type i_get_text_run_context_and_create_run_v4_tool is used by other functions
-- (e.g., socket_get_hint_run_context_and_create_run_v4). We must drop dependent functions first.
-- 1) Drop dependent functions first (functions that depend on our tool type)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop hint function that depends on our tool type
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_hint_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_hint_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
    
    -- Drop text function that depends on our tool type
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_text_run_context_for_existing_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_text_run_context_for_existing_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_text_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_text_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 3) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_get_text_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 4) Create composite types for tools array
CREATE TYPE types.i_get_text_run_context_and_create_run_v4_tool AS (
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

-- 5) Recreate function
-- Generic version that accepts agent_id, resource_type, etc.
-- Supports optional upload_id for audio input (used by audio agent)
-- Supports optional group_id and user_instructions for regeneration
CREATE OR REPLACE FUNCTION socket_get_text_run_context_and_create_run_v4(
    agent_id uuid,
    profile_id uuid,
    department_id uuid DEFAULT NULL,
    resource_type text DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,  -- Optional: for regeneration (uses existing group)
    user_instructions text DEFAULT NULL  -- Optional: user instructions for regeneration
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
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    developer_instruction_template text,
    developer_instruction_schema_id uuid,
    department_name text,
    developer_message_id uuid,
    upload_id uuid,
    file_path text,
    mime_type text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        agent_id AS agent_id, 
        profile_id AS profile_id,
        department_id AS department_id,
        resource_type AS resource_type,
        upload_id AS upload_id,
        group_id AS group_id,
        user_instructions AS user_instructions
),
upload_info AS (
    -- Get upload information when upload_id is provided (for audio input)
    SELECT 
        u.id as upload_id,
        u.file_path,
        u.mime_type
    FROM params p
    LEFT JOIN uploads u ON u.id = p.upload_id
    WHERE p.upload_id IS NOT NULL
),
-- Get or create group (for trace_id and group_id)
-- If group_id provided (regeneration), use existing group; otherwise create new one
existing_group_from_param AS (
    SELECT g.id as group_id, g.trace_id
    FROM params p
    JOIN groups g ON g.id = p.group_id
    WHERE p.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    -- Create new group if needed (only if group_id not provided)
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE p.group_id IS NULL
      AND p.department_id IS NOT NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use existing group from param, newly created group, or fallback
    SELECT 
        COALESCE(
            (SELECT group_id FROM existing_group_from_param LIMIT 1),
            (SELECT group_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::uuid  -- Fallback if no group created
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM existing_group_from_param LIMIT 1),
            (SELECT trace_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::text  -- Fallback trace_id
        ) as trace_id
),
selected_agent AS (
    -- Use provided agent_id directly
    SELECT a.id as agent_id
    FROM agent a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profile prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = (SELECT profile_id FROM params)
),
runs_today AS (
    -- Count model runs for the profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM run mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM params)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_departments pd
    CROSS JOIN params p
    WHERE pd.profile_id = p.profile_id
      AND pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM setting s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
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
            (SELECT s.id FROM setting s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = true) LIMIT 1)
        ) as settings_id
),
-- Build tool arguments from schemas
tool_schema_data AS (
    SELECT 
        t.id as tool_id,
        ts.schema_id,
        -- Build arguments JSONB from schema_fields
        COALESCE(
            jsonb_object_agg(
                sf.name,
                jsonb_build_object(
                    'type', CASE sf.field_type
                        WHEN 'string' THEN 'string'
                        WHEN 'number' THEN 'number'
                        WHEN 'boolean' THEN 'boolean'
                        WHEN 'array' THEN 'array'
                        ELSE 'string'
                    END,
                    'required', sf.required
                )
                ORDER BY sf.position
            ) FILTER (WHERE sf.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        -- Build argument_descriptions JSONB from schema_fields.description
        COALESCE(
            jsonb_object_agg(
                sf.name,
                sf.description
                ORDER BY sf.position
            ) FILTER (WHERE sf.name IS NOT NULL AND sf.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
        -- Build argument_defaults JSONB from schema_fields.default_value
        COALESCE(
            jsonb_object_agg(
                sf.name,
                CASE 
                    WHEN sf.default_value = '' THEN NULL
                    WHEN sf.field_type = 'number' THEN 
                        CASE 
                            WHEN sf.default_value ~ '^-?[0-9]+\.?[0-9]*$' THEN to_jsonb(sf.default_value::numeric)
                            ELSE NULL
                        END
                    WHEN sf.field_type = 'boolean' THEN 
                        CASE 
                            WHEN LOWER(sf.default_value) IN ('true', '1', 'yes') THEN 'true'::jsonb
                            WHEN LOWER(sf.default_value) IN ('false', '0', 'no') THEN 'false'::jsonb
                            ELSE NULL
                        END
                    WHEN sf.field_type = 'array' THEN 
                        CASE 
                            WHEN sf.default_value ~ '^\[.*\]$' THEN sf.default_value::jsonb
                            ELSE NULL
                        END
                    ELSE sf.default_value::jsonb
                END
                ORDER BY sf.position
            ) FILTER (WHERE sf.name IS NOT NULL AND sf.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool t
    LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
    LEFT JOIN schemas s ON s.id = ts.schema_id
    LEFT JOIN schema_fields sf ON sf.schema_id = s.id
    GROUP BY t.id, ts.schema_id
),
-- Get agent tools as composite type array
-- Filter tools to only include those matching the resource_type parameter (if provided)
-- If resource_type is NULL, include all tools (for backward compatibility)
-- Include tools where rt.resource matches resource_type OR rt.resource IS NULL (global tools)
agent_tools_data AS (
    SELECT 
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, t.name, COALESCE(t.description, ''), COALESCE(rt.resource::text, ''), COALESCE(da.artifact::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), t.active)::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), t.name
            ) FILTER (WHERE t.id IS NOT NULL AND (p.resource_type IS NULL OR rt.resource::text = p.resource_type OR rt.resource IS NULL)),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM selected_agent sa
    CROSS JOIN params p
    LEFT JOIN agent_tools at ON at.agent_id = sa.agent_id AND at.active = true
    LEFT JOIN tool t ON t.id = at.tool_id AND t.active = true
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN agent_domains adom ON adom.agent_id = sa.agent_id
    LEFT JOIN domain_artifacts da ON da.domain_id = adom.domain_id
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    GROUP BY sa.agent_id
),
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        sa.agent_id,
        i.template as developer_instruction_template,
        ins.schema_id as developer_instruction_schema_id
    FROM selected_agent sa
    INNER JOIN agents a ON a.id = sa.agent_id
    LEFT JOIN agent_instructions ai ON ai.agent_id = a.id
    LEFT JOIN instructions i ON i.id = ai.instruction_id AND i.active = true
    LEFT JOIN instruction_schemas ins ON ins.instruction_id = i.id
    LIMIT 1
),
-- Get department name
department_data AS (
    SELECT 
        p.department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as department_name
    FROM params p
    LEFT JOIN departments d ON d.id = p.department_id
),
context_data AS (
    -- Get all context data (agent, model, provider, etc.)
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(da.artifact::text, '') as agent_role,  -- Derive from domain_artifacts via agent_domains
        COALESCE(
            CASE 
                WHEN did.developer_instruction_template IS NOT NULL AND did.developer_instruction_template != ''
                THEN COALESCE(pr_prompt.system_prompt, '') || E'\n\n' || did.developer_instruction_template
                ELSE COALESCE(pr_prompt.system_prompt, '')
            END,
            ''
        ) as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        k.key as api_key,
        
        -- Profile data
        p.profile_id::text as profile_id,
        
        -- Rate limit data (for profile)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,
        
        -- Developer instruction data
        did.developer_instruction_template,
        did.developer_instruction_schema_id,
        
        -- Department data
        dd.department_name

    FROM selected_agent sa
    INNER JOIN agents a ON a.id = sa.agent_id
    LEFT JOIN agent_domains adom ON adom.agent_id = a.id
    LEFT JOIN domain_artifacts da ON da.domain_id = adom.domain_id
    CROSS JOIN params p
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p.department_id AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    -- Use department-specific prompt if available, otherwise use default
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN agent_models am ON am.agent_id = a.id
    INNER JOIN models m ON m.id = am.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    -- Join reasoning from junction table
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints e ON e.id = me_j.endpoint_id AND e.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider pr_prov ON pr_prov.id = p_prov.provider_id
    LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- Join tools data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
    -- Join department data
    LEFT JOIN department_data dd ON dd.department_id = p.department_id
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO run (input_tokens, output_tokens, key_id, agent_id)
    SELECT 0, 0, NULL, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.id, cd.model_id::uuid, true
    FROM create_run cr
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    RETURNING run_id
),
link_group AS (
    -- Link group to run
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT gd.group_id, lp.run_id, 0, NOW(), NOW()
    FROM link_profile lp
    CROSS JOIN group_data gd
    RETURNING run_id
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
    -- Group ID and trace_id (from groups table)
    gd.group_id,
    gd.trace_id::text as trace_id,
    -- Tools array
    cd.tools,
    -- Developer instruction (kept for backward compatibility but not used separately)
    cd.developer_instruction_template,
    cd.developer_instruction_schema_id,
    -- Department name
    cd.department_name,
    -- Developer message ID (removed - instructions now in system_prompt)
    NULL::uuid as developer_message_id,
    -- Upload info (for audio input, when upload_id is provided)
    ui.upload_id,
    ui.file_path,
    ui.mime_type
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
LEFT JOIN upload_info ui ON true
$$;

