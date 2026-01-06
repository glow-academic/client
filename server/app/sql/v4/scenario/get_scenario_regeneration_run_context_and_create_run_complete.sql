-- Get all data needed to run scenario regeneration agent AND create run in single atomic transaction
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
        WHERE proname = 'socket_get_scenario_regeneration_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_scenario_regeneration_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types
-- Drop all types matching prefix pattern to handle type additions/removals
-- Also handle truncated type names (PostgreSQL identifier limit is 63 chars)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all types matching prefix pattern (includes truncated name and shortened variants)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE (typname LIKE 'i_get_scenario_regeneration_run_context_and_create_run_v4_%'
           OR typname LIKE 'i_scenario_regen_run_context_create_run_v4_%')
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
-- Use shortened name (62 chars) to avoid PostgreSQL 63-char identifier limit issues
CREATE TYPE types.i_get_scenario_regeneration_run_context_and_create_run_v4_doc AS (
    id text,
    name text,
    file_path text,
    mime_type text,
    template boolean,
    schema_id uuid
);

CREATE TYPE types.i_get_scenario_regeneration_run_context_and_create_run_v4_document_template AS (
    document_id text,
    document_name text,
    schema_id uuid,
    html_id text
);

CREATE TYPE types.i_get_scenario_regeneration_run_context_and_create_run_v4_parameter_item AS (
    item_name text,
    item_description text,
    param_name text,
    param_description text
);

CREATE TYPE types.i_scenario_regen_run_context_create_run_v4_msg AS (
    role text,
    content text
);

-- 4) Recreate function
-- group_id is REQUIRED (not NULL) for regeneration - uses existing group
CREATE OR REPLACE FUNCTION socket_get_scenario_regeneration_run_context_and_create_run_v4(
    department_id uuid,
    profile_id uuid,
    agent_id uuid,
    group_id uuid,  -- REQUIRED for regeneration (not NULL)
    persona_id uuid DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    parameter_item_ids uuid[] DEFAULT NULL,
    user_instructions text DEFAULT NULL
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
    custom_model text,
    provider_id text,
    provider_name text,
    persona_id text,
    persona_name text,
    persona_description text,
    documents types.i_get_scenario_regeneration_run_context_and_create_run_v4_doc[],
    document_templates types.i_get_scenario_regeneration_run_context_and_create_run_v4_document_template[],
    parameter_items types.i_get_scenario_regeneration_run_context_and_create_run_v4_parameter_item[],
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    run_id text,
    group_id uuid,
    trace_id text,
    previous_messages types.i_scenario_regen_run_context_create_run_v4_msg[]  -- All messages from all previous runs in group
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        department_id AS department_id, 
        profile_id AS profile_id, 
        agent_id AS agent_id,
        group_id AS group_id,
        persona_id AS persona_id,
        document_ids AS document_ids,
        parameter_item_ids AS parameter_item_ids,
        user_instructions AS user_instructions
),
group_data AS (
    -- Use existing group (required for regeneration)
    SELECT 
        g.id as group_id,
        g.trace_id
    FROM groups g
    CROSS JOIN params p
    WHERE g.id = p.group_id
),
previous_runs_in_group AS (
    -- Get all previous runs in the group (all runs except the one we're about to create)
    SELECT gr.run_id
    FROM group_runs gr
    CROSS JOIN params p
    WHERE gr.group_id = p.group_id
    ORDER BY gr.idx ASC  -- Order by idx to maintain chronological order
),
previous_messages_all_runs AS (
    -- Get all messages from all previous runs in the group
    -- Ordered chronologically across all runs
    SELECT 
        m.role,
        cnt.content,
        m.created_at,
        gr.idx as run_idx
    FROM previous_runs_in_group prig
    JOIN group_runs gr ON gr.run_id = prig.run_id
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN messages m ON m.id = mr.message_id
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN content cnt ON cnt.id = mc.content_id
    ORDER BY gr.idx ASC, m.created_at ASC  -- Order by run idx first, then message created_at
),
previous_messages_array AS (
    -- Aggregate all previous messages into composite type array
    SELECT COALESCE(
        ARRAY_AGG(
            (role, content)::types.i_scenario_regen_run_context_create_run_v4_msg
            ORDER BY run_idx, created_at
        ),
        '{}'::types.i_scenario_regen_run_context_create_run_v4_msg[]
    ) as previous_messages
    FROM previous_messages_all_runs
),
best_agent AS (
    -- Use the provided agent_id directly (UI handles filtering and selection)
    SELECT a.id as agent_id
    FROM agents a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
    AND a.active = true
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
    -- Get settings with no department links (cross-department/default)
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
context_data AS (
    -- Get all context data (agent, model, provider, persona, documents, etc.)
    SELECT 
        -- Agent data (via department_agents junction for 'scenario' role)
        a.id::text as agent_id,
        a.name as agent_name,
        COALESCE(aa.role, '') as agent_role,  -- Derive from artifact_agents
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(p_prov.value::text, '') as provider,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        -- Custom model (if any) - indicated by presence of base_url in model_endpoints
        CASE WHEN me.base_url IS NOT NULL AND me.base_url != '' THEN m.value ELSE NULL END as custom_model,
        -- Provider data (provider enum is now on models table, no separate providers table)
        NULL::text as provider_id,
        COALESCE(p_prov.value::text, '') as provider_name,
        
        -- Persona data (nullable)
        pers.id::text as persona_id,
        pers.name as persona_name,
        pers.description as persona_description,
        
        -- Documents data (aggregated as composite type array)
        -- Includes template file paths for template documents (COALESCE pattern)
        COALESCE(
            (SELECT ARRAY_AGG(
                (d.id::text, d.name, COALESCE(u.file_path, template_u.file_path), COALESCE(u.mime_type, template_u.mime_type), d.template, ds.schema_id)::types.i_get_scenario_regeneration_run_context_and_create_run_v4_doc
                ORDER BY array_position(p.document_ids, d.id)
            )::types.i_get_scenario_regeneration_run_context_and_create_run_v4_doc[]
            FROM documents d
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
            LEFT JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
            LEFT JOIN document_html dh ON dh.document_id = d.id AND dh.active = true
            LEFT JOIN html h ON h.id = dh.html_id
            LEFT JOIN html_uploads hu ON hu.html_id = h.id AND hu.active = true
            LEFT JOIN uploads template_u ON template_u.id = hu.upload_id
            LEFT JOIN document_schemas ds ON ds.document_id = d.id AND ds.active = true
            WHERE d.id = ANY(p.document_ids)
            ),
            ARRAY[]::types.i_get_scenario_regeneration_run_context_and_create_run_v4_doc[]
        ) as documents,
        
        -- Document templates data (aggregated as composite type array for template documents)
        COALESCE(
            (SELECT ARRAY_AGG(
                (d.id::text, d.name, ds.schema_id, dh.html_id::text)::types.i_get_scenario_regeneration_run_context_and_create_run_v4_document_template
                ORDER BY array_position(p.document_ids, d.id)
            )::types.i_get_scenario_regeneration_run_context_and_create_run_v4_document_template[]
            FROM documents d
            INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
            LEFT JOIN document_html dh ON dh.document_id = d.id AND dh.active = true
            LEFT JOIN document_schemas ds ON ds.document_id = d.id AND ds.active = true
            WHERE d.id = ANY(p.document_ids)
              AND d.template = true
            ),
            ARRAY[]::types.i_get_scenario_regeneration_run_context_and_create_run_v4_document_template[]
        ) as document_templates,
        
        -- Parameter items data (aggregated as composite type array with parameter info)
        COALESCE(
            (SELECT ARRAY_AGG(
                (f.name, f.description, pa.name, pa.description)::types.i_get_scenario_regeneration_run_context_and_create_run_v4_parameter_item
                ORDER BY array_position(p.parameter_item_ids, f.id)
            )::types.i_get_scenario_regeneration_run_context_and_create_run_v4_parameter_item[]
            FROM fields f
            JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
            JOIN parameters pa ON pa.id = fp.parameter_id
            WHERE f.id = ANY(p.parameter_item_ids)
            ),
            ARRAY[]::types.i_get_scenario_regeneration_run_context_and_create_run_v4_parameter_item[]
        ) as parameter_items,
        
        -- Rate limit data (for profile)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Profile ID
        p.profile_id::text as profile_id

    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN artifact_agents aa ON aa.agent_id = a.id AND aa.artifact_instance_id IS NULL
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
    LEFT JOIN providers p_prov ON p_prov.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    LEFT JOIN personas pers ON pers.id = p.persona_id
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
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
    -- Link run to existing group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.id as run_id,
        (SELECT COALESCE(MAX(idx), -1) + 1 FROM group_runs WHERE group_id = gd.group_id) as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
),
link_existing_messages AS (
    -- Link existing system/developer messages from previous runs to new run
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT DISTINCT mr.message_id, cr.id, NOW(), NOW()
    FROM previous_runs_in_group prig
    CROSS JOIN create_run cr
    JOIN message_runs mr ON mr.run_id = prig.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role IN ('system'::message_role, 'developer'::message_role)
    ON CONFLICT (message_id, run_id)
    DO UPDATE SET updated_at = NOW()
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
    cd.custom_model,
    cd.provider_id,
    cd.provider_name,
    cd.persona_id,
    cd.persona_name,
    cd.persona_description,
    cd.documents,
    cd.document_templates,
    cd.parameter_items,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Group ID and trace_id (from existing group)
    gd.group_id,
    gd.trace_id,
    -- Previous messages (from all previous runs in group)
    pma.previous_messages
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
CROSS JOIN previous_messages_array pma
$$;