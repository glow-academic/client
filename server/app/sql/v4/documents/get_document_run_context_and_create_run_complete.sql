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
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
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
    FROM agents a
    INNER JOIN domains d ON d.agent_id = a.id AND d.artifact = CAST('document' AS artifacts)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN params p
    WHERE a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = p.department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = p.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = (SELECT profile_id FROM params)
),
runs_today AS (
    -- Count model runs for the profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM params)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
-- Use profile's primary department for settings resolution
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
    FROM settings s
    WHERE s.active = true
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true 
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND s.active = true AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE s.active = true
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
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
),
-- Get agent tools as composite type array
agent_tools_data AS (
    SELECT 
        ba.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, t.name, COALESCE(t.description, ''), COALESCE(rt.resource::text, ''), COALESCE(d.artifact::text, ''), t.arguments, t.argument_descriptions, t.argument_defaults, t.active)::types.i_get_document_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), t.name
            ) FILTER (WHERE t.id IS NOT NULL),
            '{}'::types.i_get_document_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM best_agent ba
    LEFT JOIN agent_tools at ON at.agent_id = ba.agent_id AND at.active = true
    LEFT JOIN tools t ON t.id = at.tool_id AND t.active = true
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN domains d ON d.agent_id = ba.agent_id
    GROUP BY ba.agent_id
),
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        ba.agent_id,
        di.template as developer_instruction_template,
        dis.schema_id as developer_instruction_schema_id
    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN domains d ON d.agent_id = a.id
    -- Join developer_instructions via agent_developer_instructions (following {strong}_{weak} pattern)
    LEFT JOIN agent_developer_instructions adi ON adi.agent_id = a.id
    LEFT JOIN developer_instructions di ON di.id = adi.developer_instruction_id AND di.active = true
    LEFT JOIN developer_instruction_schemas dis ON dis.developer_instruction_id = di.id
    LIMIT 1
),
-- Get department name
department_data AS (
    SELECT 
        p.department_id,
        d.title as department_name
    FROM params p
    LEFT JOIN departments d ON d.id = p.department_id
),
-- Get template context fields (if field_ids provided)
template_context_fields_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (f.name, COALESCE(f.description, ''), pa.name, COALESCE(pa.description, ''))::types.i_get_document_run_context_and_create_run_v4_field
                ORDER BY array_position(p.field_ids, f.id)
            ),
            '{}'::types.i_get_document_run_context_and_create_run_v4_field[]
        ) as template_context_fields
    FROM params p
    LEFT JOIN fields f ON f.id = ANY(p.field_ids) AND p.field_ids IS NOT NULL AND array_length(p.field_ids, 1) > 0
    LEFT JOIN parameters pa ON pa.id = f.parameter_id AND pa.active = true
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
        a.name as agent_name,
        COALESCE(d.artifact::text, '') as agent_role,  -- Derive from domains
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        
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
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN domains d ON d.agent_id = a.id
    CROSS JOIN params p
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = p.department_id AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    -- Use department-specific prompt if available, otherwise use default
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN models m ON m.id = a.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    -- Join reasoning from junction table
    -- IMPORTANT: Only join reasoning levels that belong to the agent's model (m.id = mrl.model_id)
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN providers prov ON prov.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- Join tools data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = ba.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = ba.agent_id
    -- Join department data
    LEFT JOIN department_data dd ON dd.department_id = p.department_id
    -- Join template context fields data
    LEFT JOIN template_context_fields_data tcfd ON true
    -- Validate rate limit: raises exception if exceeded (function returns TRUE if valid)
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
create_run AS (
    -- Create run record with all junction records (atomic with context query)
    INSERT INTO runs (input_tokens, output_tokens, key_id, agent_id)
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
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN content cnt ON cnt.id = mc.content_id
    JOIN developer_message_hash dmh ON message_content_hash(cnt.content, 'developer') = dmh.hash
    WHERE m.role = 'developer'
    LIMIT 1
),
new_developer_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    FROM developer_message_hash dmh
    WHERE NOT EXISTS (SELECT 1 FROM existing_developer_message)
    RETURNING id, created_at, updated_at
),
insert_developer_content AS (
    INSERT INTO content (content, created_at, updated_at)
    SELECT 
        (SELECT content FROM developer_message_hash LIMIT 1),
        nm.created_at,
        nm.updated_at
    FROM new_developer_message nm
    WHERE EXISTS (SELECT 1 FROM developer_message_content)
    RETURNING id as content_id, created_at, updated_at
),
insert_developer_message_content AS (
    INSERT INTO message_content (message_id, content_id, idx, created_at, updated_at)
    SELECT 
        nm.id,
        ic.content_id,
        0,
        ic.created_at,
        ic.updated_at
    FROM new_developer_message nm
    CROSS JOIN insert_developer_content ic
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
link_developer_message_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT dmf.id, dmf.run_id, NOW(), NOW()
    FROM developer_message_final dmf
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
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