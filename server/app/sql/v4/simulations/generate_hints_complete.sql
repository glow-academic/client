-- Generate hints for a simulation message - complete unit of work
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- NOTE: This function depends on types.i_get_text_run_context_and_create_run_v4_tool from
-- get_text_run_context_and_create_run_complete.sql. That type must be created before this function.
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_hint_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_hint_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
-- NOTE: We do NOT drop i_get_text_run_context_and_create_run_v4_tool here as it's defined
-- in get_text_run_context_and_create_run_complete.sql and may be used by other functions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_get_hint_run_context_and_create_run_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_get_hint_run_context_and_create_run_v4_document AS (
    document_id uuid,
    name text,
    file_path text,
    mime_type text
);

-- 4) Recreate function
-- NO run creation or rate limiting - only gets agent context
-- Run creation happens in generate/start.py
-- Supports optional group_id and user_instructions for regeneration
CREATE OR REPLACE FUNCTION socket_get_hint_run_context_and_create_run_v4(
    message_id uuid,
    chat_id uuid,
    department_id uuid,
    profile_id uuid,
    group_id uuid DEFAULT NULL,  -- Optional: for regeneration (uses existing group)
    user_instructions text DEFAULT NULL  -- Optional: user instructions for regeneration (passed through to generate_start)
)
RETURNS TABLE (
    -- Minimal output - only what's needed for dispatch to generate_start
    agent_id text,
    agent_role text,  -- Required: used for dispatch mapping
    chat_id text,
    group_id uuid,  -- Optional: for regeneration (if provided, uses existing group)
    developer_instruction_template text  -- Optional: developer instruction template for rendering
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT message_id, chat_id, department_id, profile_id, group_id, user_instructions
),
target_message AS (
    SELECT m.id, c.id AS chat_id, m.role, cnt.content, m.created_at
    FROM messages m
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN runs r ON r.id = mr.run_id
    JOIN group_runs gr ON gr.run_id = r.id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chats c ON c.id = cg.chat_id
    CROSS JOIN params p
    WHERE m.id = p.message_id AND c.id = p.chat_id
),
chat_info AS (
    SELECT sc.id, ac.attempt_id, sc.scenario_id, g.trace_id, sc.title
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
    LEFT JOIN chat_groups cg ON cg.chat_id = sc.id
    LEFT JOIN groups g ON g.id = cg.group_id
    JOIN target_message tm ON tm.chat_id = sc.id
),
attempt_info AS (
    SELECT sa.id, sa.simulation_id
    FROM simulation_attempts sa
    JOIN chat_info ci ON ci.attempt_id = sa.id
),
scenario_info AS (
    SELECT s.id, ps.problem_statement
    FROM scenarios s
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    JOIN chat_info ci ON ci.scenario_id = s.id
),
profile_info AS (
    SELECT profile_id as profile_id
    FROM attempt_profiles ap
    JOIN attempt_info ai ON ai.id = ap.attempt_id
    WHERE ap.active = true
      AND ap.profile_id = profile_id
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    INNER JOIN agent_domains adom ON adom.agent_id = a.id
    INNER JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('message' AS artifacts)  -- hint maps to message artifact
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = department_id
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = profile_id
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = profile_id
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
default_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
profile_primary_department AS (
    SELECT pd.department_id
    FROM profile_info pi
    JOIN profile_departments pd ON pd.profile_id = pi.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true) 
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
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
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
            (SELECT id FROM settings s WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
-- Document data for composite type aggregation
document_data AS (
    SELECT 
        d.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        u.file_path,
        u.mime_type
    FROM scenario_info si
    CROSS JOIN scenario_documents sd
    JOIN documents d ON d.id = sd.document_id
    LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
    LEFT JOIN uploads u ON u.id = du.upload_id
    WHERE sd.scenario_id = si.id AND sd.active = true
),
-- Get or create group (for trace_id and group_id)
-- If group_id provided (regeneration), use existing group; otherwise create/get from chat
existing_group_from_param AS (
    SELECT g.id as group_id, g.trace_id
    FROM params p
    JOIN groups g ON g.id = p.group_id
    WHERE p.group_id IS NOT NULL
    LIMIT 1
),
existing_group_from_chat AS (
    SELECT g.id as group_id, g.trace_id
    FROM chat_info ci
    JOIN chat_groups cg ON cg.chat_id = ci.id
    JOIN groups g ON g.id = cg.group_id
    WHERE NOT EXISTS (SELECT 1 FROM existing_group_from_param)
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM chat_info ci
    WHERE NOT EXISTS (SELECT 1 FROM existing_group_from_param)
      AND NOT EXISTS (SELECT 1 FROM existing_group_from_chat)
    RETURNING id as group_id, trace_id
),
group_data AS (
    SELECT 
        COALESCE(
            (SELECT group_id FROM existing_group_from_param LIMIT 1),
            (SELECT group_id FROM existing_group_from_chat LIMIT 1),
            (SELECT group_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::uuid
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM existing_group_from_param LIMIT 1),
            (SELECT trace_id FROM existing_group_from_chat LIMIT 1),
            (SELECT trace_id FROM create_group_if_needed LIMIT 1),
            gen_random_uuid()::text
        ) as trace_id
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
    FROM tools t
    LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
    LEFT JOIN schemas s ON s.id = ts.schema_id
    LEFT JOIN schema_fields sf ON sf.schema_id = s.id
    GROUP BY t.id, ts.schema_id
),
-- Get agent tools as composite type array
agent_tools_data AS (
    SELECT 
        ba.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, t.name, COALESCE(t.description, ''), COALESCE(rt.resource::text, ''), COALESCE(da.artifact::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), t.active)::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), t.name
            ),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM best_agent ba
    LEFT JOIN agent_tools at ON at.agent_id = ba.agent_id AND at.active = true
    LEFT JOIN tools t ON t.id = at.tool_id AND t.active = true
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN agent_domains adom ON adom.agent_id = ba.agent_id
    LEFT JOIN domain_artifacts da ON da.domain_id = adom.domain_id
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    GROUP BY ba.agent_id
),
-- Get developer instruction using agent role
developer_instruction_data AS (
    SELECT 
        ba.agent_id,
        i.template as developer_instruction_template,
        ins.schema_id as developer_instruction_schema_id
    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN agent_domains adom_dev ON adom_dev.agent_id = a.id
    LEFT JOIN domain_artifacts da_dev ON da_dev.domain_id = adom_dev.domain_id
    LEFT JOIN agent_instructions ai ON ai.agent_id = a.id
    LEFT JOIN instructions i ON i.id = ai.instruction_id AND i.active = true
    LEFT JOIN instruction_schemas ins ON ins.instruction_id = i.id
    LIMIT 1
),
-- Get department name
department_data AS (
    SELECT 
        p_params.department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as department_name
    FROM params p_params
    LEFT JOIN departments d ON d.id = p_params.department_id
),
-- Context data - minimal (no rate limit, no run creation)
context_data AS (
    SELECT 
        -- Only fields needed for dispatch
        a.id::text as agent_id,
        COALESCE(da_ctx.artifact::text, '') as agent_role,  -- Derive from domain_artifacts via agent_domains
        ci.id::text as chat_id
    FROM target_message tm
    CROSS JOIN chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN scenario_info si
    CROSS JOIN best_agent ba
    CROSS JOIN params p_params
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN agent_domains adom_ctx ON adom_ctx.agent_id = a.id
    LEFT JOIN domain_artifacts da_ctx ON da_ctx.domain_id = adom_ctx.domain_id
    -- NO rate limit check - handled in generate/start.py
    -- NO run creation - handled in generate/start.py
    -- NO tools, developer instructions, etc. - fetched by modality handlers
)
SELECT 
    -- Minimal output - only what's needed for dispatch
    cd.agent_id,
    cd.agent_role,
    cd.chat_id,
    p_params.group_id as group_id,  -- Pass through group_id if provided (for regeneration)
    did.developer_instruction_template  -- Developer instruction template (may be NULL)
FROM context_data cd
CROSS JOIN params p_params
LEFT JOIN developer_instruction_data did ON true  -- Join to get developer instruction template
$$;