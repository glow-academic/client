-- Get all data needed to run scenario agent AND create run in single atomic transaction
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
        WHERE proname = 'socket_get_scenario_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_scenario_run_context_and_create_run_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_get_scenario_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
CREATE TYPE types.i_get_scenario_run_context_and_create_run_v4_document AS (
    id text,
    name text,
    file_path text,
    mime_type text,
    template boolean,
    template_args jsonb
);

CREATE TYPE types.i_get_scenario_run_context_and_create_run_v4_document_template AS (
    document_id text,
    document_name text,
    document_description text,
    classify_agent_id text,
    document_agent_id text,
    template_args jsonb,
    template_upload_id text,
    template_file_path text
);

CREATE TYPE types.i_get_scenario_run_context_and_create_run_v4_parameter_item AS (
    item_name text,
    item_description text,
    param_name text,
    param_description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_scenario_run_context_and_create_run_v4(
    department_id uuid,
    profile_id uuid,
    agent_id uuid,
    group_id uuid DEFAULT NULL,
    persona_id uuid DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    parameter_item_ids uuid[] DEFAULT NULL
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
    documents types.i_get_scenario_run_context_and_create_run_v4_document[],
    document_templates types.i_get_scenario_run_context_and_create_run_v4_document_template[],
    parameter_items types.i_get_scenario_run_context_and_create_run_v4_parameter_item[],
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    primary_color text,
    accent text,
    background text,
    surface text,
    success text,
    warning text,
    error text,
    sidebar_background text,
    sidebar_primary text,
    chart1 text,
    chart2 text,
    chart3 text,
    chart4 text,
    chart5 text,
    run_id text,
    group_id uuid,
    trace_id text
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
        parameter_item_ids AS parameter_item_ids
),
create_group_if_needed AS (
    -- Create new group if group_id is NULL
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params p
    WHERE p.group_id IS NULL
    RETURNING id as group_id, trace_id
),
group_data AS (
    -- Use existing group if provided, otherwise use newly created group
    SELECT 
        COALESCE(
            (SELECT g.id FROM groups g CROSS JOIN params p WHERE g.id = p.group_id),
            (SELECT cg.group_id FROM create_group_if_needed cg)
        ) as group_id,
        COALESCE(
            (SELECT g.trace_id FROM groups g CROSS JOIN params p WHERE g.id = p.group_id),
            (SELECT cg.trace_id FROM create_group_if_needed cg)
        ) as trace_id
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
-- Get active settings for profile (for key lookup and theme tokens)
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
    -- Get department-specific settings (if profile has primary department)
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
    -- Settings that have at least one active provider key
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys k ON k.id = spk.key_id
    WHERE spk.active = true AND k.active = true
),
dept_specific_settings_with_keys AS (
    -- Department-specific settings that have keys
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
    -- Default settings that have keys
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
    -- Prefer department-specific with keys, then default with keys, then any with keys, then fallback
    -- Only use department-specific/default settings if they have keys, otherwise prefer any settings with keys
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),  -- Any with keys
            (SELECT settings_id FROM dept_specific_settings),  -- Original fallback (no keys available)
            (SELECT settings_id FROM default_settings),  -- Original fallback (no keys available)
            (SELECT id FROM settings WHERE active = true LIMIT 1)  -- Last resort
        ) as settings_id
),
context_data AS (
    -- Get all context data (agent, model, provider, persona, documents, etc.)
    SELECT 
        -- Agent data (via department_agents junction for 'scenario' role)
        a.id::text as agent_id,
        a.name as agent_name,
        a.role::text as agent_role,
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
                (d.id::text, d.name, COALESCE(u.file_path, template_u.file_path), COALESCE(u.mime_type, template_u.mime_type), d.template, t.args)::types.i_get_scenario_run_context_and_create_run_v4_document
                ORDER BY array_position(p.document_ids, d.id)
            )::types.i_get_scenario_run_context_and_create_run_v4_document[]
            FROM documents d
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
            LEFT JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
            LEFT JOIN templates t ON t.id = dt.template_id
            LEFT JOIN uploads template_u ON template_u.id = t.upload_id
            WHERE d.id = ANY(p.document_ids)
            ),
            ARRAY[]::types.i_get_scenario_run_context_and_create_run_v4_document[]
        ) as documents,
        
        -- Document templates data (aggregated as composite type array for template documents)
        -- Includes all parent document info needed for child creation
        COALESCE(
            (SELECT ARRAY_AGG(
                (d.id::text, d.name, COALESCE(d.description, ''), d.classify_agent_id::text, d.document_agent_id::text, t.args, t.upload_id::text, u.file_path)::types.i_get_scenario_run_context_and_create_run_v4_document_template
                ORDER BY array_position(p.document_ids, d.id)
            )::types.i_get_scenario_run_context_and_create_run_v4_document_template[]
            FROM documents d
            INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
            INNER JOIN templates t ON t.id = dt.template_id
            INNER JOIN uploads u ON u.id = t.upload_id
            WHERE d.id = ANY(p.document_ids)
              AND d.template = true
            ),
            ARRAY[]::types.i_get_scenario_run_context_and_create_run_v4_document_template[]
        ) as document_templates,
        
        -- Parameter items data (aggregated as composite type array with parameter info)
        COALESCE(
            (SELECT ARRAY_AGG(
                (f.name, f.description, pa.name, pa.description)::types.i_get_scenario_run_context_and_create_run_v4_parameter_item
                ORDER BY array_position(p.parameter_item_ids, f.id)
            )::types.i_get_scenario_run_context_and_create_run_v4_parameter_item[]
            FROM fields f
            JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
            JOIN parameters pa ON pa.id = fp.parameter_id
            WHERE f.id = ANY(p.parameter_item_ids)
            ),
            ARRAY[]::types.i_get_scenario_run_context_and_create_run_v4_parameter_item[]
        ) as parameter_items,
        
        -- Rate limit data (for profile)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Profile ID
        p.profile_id::text as profile_id,
        
        -- Theme tokens from settings (for Jinja2 rendering)
        s.primary_color,
        s.accent,
        s.background,
        s.surface,
        s.success,
        s.warning,
        s.error,
        s.sidebar_background,
        s.sidebar_primary,
        s.chart1,
        s.chart2,
        s.chart3,
        s.chart4,
        s.chart5

    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
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
    CROSS JOIN active_settings act_s_key
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p_prov.id 
        AND spk.settings_id = act_s_key.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    LEFT JOIN personas pers ON pers.id = p.persona_id
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN active_settings act_s
    JOIN settings s ON s.id = act_s.settings_id
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
    -- Link run to group via group_runs junction table
    INSERT INTO group_runs (group_id, run_id, idx)
    SELECT 
        gd.group_id,
        cr.id as run_id,
        0 as idx
    FROM group_data gd
    CROSS JOIN create_run cr
    RETURNING group_id, run_id
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
    -- Theme tokens (for Jinja2 rendering)
    cd.primary_color,
    cd.accent,
    cd.background,
    cd.surface,
    cd.success,
    cd.warning,
    cd.error,
    cd.sidebar_background,
    cd.sidebar_primary,
    cd.chart1,
    cd.chart2,
    cd.chart3,
    cd.chart4,
    cd.chart5,
    -- Run ID (created in same transaction)
    cr.id::text as run_id,
    -- Group ID and trace_id (from groups table - auto-generated)
    gd.group_id,
    gd.trace_id
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN group_data gd
$$;