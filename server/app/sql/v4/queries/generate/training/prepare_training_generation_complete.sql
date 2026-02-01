-- Prepare training generation: rate limit check, group/run creation, and full context fetch
-- Returns everything needed for scenario content generation
-- All business logic in one SQL function - fail fast on rate limit

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_training_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_training_generation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type for tools (reuse existing if available)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_get_text_run_context_and_create_run_v4_tool'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_get_text_run_context_and_create_run_v4_tool AS (
            id uuid,
            name text,
            description text,
            resource text,
            artifact text,
            arguments jsonb,
            argument_descriptions jsonb,
            argument_defaults jsonb,
            active boolean
        );
    END IF;
END $$;

-- 3) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_training_generation_v4(
    p_profile_id uuid,
    p_agent_id uuid,
    p_simulation_id uuid,
    p_scenario_id uuid DEFAULT NULL,
    p_resource_types text[] DEFAULT ARRAY['problem_statements', 'objectives', 'personas']
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    trace_id text,
    scenario_id uuid,
    -- Agent context
    agent_name text,
    system_prompt text,
    -- Model context (API key encrypted - Python handler decrypts)
    model_name text,
    provider_name text,
    base_url text,
    api_key text,
    temperature float,
    reasoning text,
    -- Tools filtered by resource type
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    -- Developer instruction templates (raw - Python renders with Jinja)
    developer_instruction_templates text[],
    -- Jinja context (simulation, scenario, current, available)
    jinja_context jsonb
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_agent_id AS agent_id,
        p_simulation_id AS simulation_id,
        p_scenario_id AS scenario_id,
        p_resource_types AS resource_types
),
-- Resolve scenario (use provided or first from simulation)
resolved_scenario AS (
    SELECT
        COALESCE(p.scenario_id, (
            SELECT sc.id
            FROM simulation_scenarios_junction ss
            JOIN scenario_artifact sc ON sc.id = ss.scenario_id
            WHERE ss.simulation_id = p.simulation_id
              AND ss.active = true
            ORDER BY COALESCE(
                (SELECT spr.value
                 FROM simulation_scenario_positions_junction ssp
                 JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
                 WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id
                 LIMIT 1),
                999999
            ) ASC
            LIMIT 1
        )) as scenario_id
    FROM params p
),
-- Validate agent exists and is active
selected_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    LIMIT 1
),
-- Get rate limit for profile
profile_rate_limit AS (
    SELECT
        rl.requests_per_day as req_per_day
    FROM profile_artifact prof
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE prof.id = (SELECT profile_id FROM params)
),
-- Count runs today for rate limiting
runs_today AS (
    SELECT
        COUNT(*)::bigint as runs_today_count
    FROM profile_runs_junction prj
    JOIN view_runs_entry mr ON mr.id = prj.run_id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Create new group for training generation
create_group AS (
    INSERT INTO view_groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(), (
        SELECT id FROM view_sessions_entry
        WHERE view_sessions_entry.profile_id = p_profile_id
          AND view_sessions_entry.active = true
        ORDER BY created_at DESC
        LIMIT 1
    )
    FROM params p
    RETURNING id as group_id, trace_id
),
group_data AS (
    SELECT
        COALESCE(
            (SELECT group_id FROM create_group LIMIT 1),
            gen_random_uuid()::uuid
        ) as group_id,
        COALESCE(
            (SELECT trace_id FROM create_group LIMIT 1),
            gen_random_uuid()::text
        ) as trace_id
),
-- Validate rate limit (raises exception if exceeded) - FAIL FAST
rate_limit_check AS (
    SELECT
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count
    FROM profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN params p
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
-- Create run with group_id
create_run AS (
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id)
    SELECT 0, 0, gd.group_id
    FROM selected_agent sa
    CROSS JOIN rate_limit_check rlc
    CROSS JOIN params p
    CROSS JOIN group_data gd
    RETURNING id as run_id
),
link_run_agent AS (
    INSERT INTO agent_runs_junction (agent_id, run_id)
    SELECT sa.agent_id, cr.run_id
    FROM selected_agent sa
    CROSS JOIN create_run cr
),
link_run_to_profile AS (
    INSERT INTO profile_runs_junction (profile_id, run_id)
    SELECT p.profile_id, cr.run_id
    FROM params p
    CROSS JOIN create_run cr
    WHERE p.profile_id IS NOT NULL
),
-- Get primary department for profile (for key lookup)
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id
    WHERE pd.is_primary = TRUE
      AND pd.active = true
    LIMIT 1
),
-- Get active settings with keys
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
      AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
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
            (SELECT settings_id FROM settings_with_keys LIMIT 1)
        ) as settings_id
),
-- Build tool arguments from args_resource
tool_schema_data AS (
    SELECT
        t.id as tool_id,
        ta.args_id as schema_id,
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
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
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
-- Get agent tools filtered by resource_type (problem_statements, objectives, personas)
agent_tools_data AS (
    SELECT
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(rt.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
            ) FILTER (WHERE t.id IS NOT NULL AND (
                p.resource_types IS NULL
                OR rt.resource IS NULL
                OR rt.resource::text = ANY(p.resource_types)
            )),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM selected_agent sa
    CROSS JOIN params p
    LEFT JOIN agent_tools_junction at ON at.agent_id = sa.agent_id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    GROUP BY sa.agent_id
),
-- Get developer instruction templates (array)
developer_instruction_data AS (
    SELECT
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(i.template ORDER BY i.created_at),
            ARRAY[]::text[]
        ) as developer_instruction_templates
    FROM selected_agent sa
    INNER JOIN agent_artifact a ON a.id = sa.agent_id
    LEFT JOIN agent_instructions_junction ai ON ai.agent_id = a.id
    LEFT JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
    GROUP BY sa.agent_id
),
-- Fetch simulation data for Jinja context
simulation_context AS (
    SELECT
        jsonb_build_object(
            'id', s.id::text,
            'name', (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1),
            'description', (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1)
        ) as simulation_data
    FROM params p
    JOIN simulation_artifact s ON s.id = p.simulation_id
),
-- Fetch scenario data for Jinja context
scenario_context AS (
    SELECT
        sc.id as scenario_id,
        jsonb_build_object(
            'id', sc.id::text,
            'name', (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = sc.id LIMIT 1)
        ) as scenario_data
    FROM resolved_scenario rs
    JOIN scenario_artifact sc ON sc.id = rs.scenario_id
),
-- Fetch current scenario content (existing values)
current_content AS (
    SELECT
        -- Current problem statement (if exists)
        (SELECT jsonb_build_object(
            'id', psr.id::text,
            'problem_statement', psr.problem_statement
         )
         FROM scenario_problem_statements_junction spj
         JOIN problem_statements_resource psr ON psr.id = spj.problem_statement_id
         WHERE spj.scenario_id = rs.scenario_id AND spj.active = true
         LIMIT 1) as problem_statement,
        -- Current objectives (if exist)
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', o.id::text,
                'objective', o.objective
             ))
             FROM scenario_objectives_junction soj
             JOIN objectives_resource o ON o.id = soj.objective_id
             WHERE soj.scenario_id = rs.scenario_id AND soj.active = true),
            '[]'::jsonb
        ) as objectives,
        -- Current persona (if exists)
        (SELECT jsonb_build_object(
            'id', pa.id::text,
            'name', (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pa.id LIMIT 1),
            'description', (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = pa.id LIMIT 1)
         )
         FROM scenario_personas_junction spj
         JOIN persona_artifact pa ON pa.id = spj.persona_id
         WHERE spj.scenario_id = rs.scenario_id AND spj.active = true
         LIMIT 1) as persona
    FROM resolved_scenario rs
),
-- Fetch available resources for generation
available_resources AS (
    SELECT
        -- Available problem statements (from simulation or global)
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', psr.id::text,
                'problem_statement', psr.problem_statement
             ))
             FROM problem_statements_resource psr
             WHERE psr.active = true
             LIMIT 20),
            '[]'::jsonb
        ) as problem_statements,
        -- Available objectives
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', o.id::text,
                'objective', o.objective
             ))
             FROM objectives_resource o
             WHERE o.active = true
             LIMIT 50),
            '[]'::jsonb
        ) as objectives,
        -- Available personas
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', pa.id::text,
                'name', (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = pa.id LIMIT 1),
                'description', (SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = pa.id LIMIT 1)
             ))
             FROM persona_artifact pa
             WHERE EXISTS (SELECT 1 FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = pa.id AND f.name = 'persona_active' AND pf.value = true)
             LIMIT 20),
            '[]'::jsonb
        ) as personas
),
-- Combine all into Jinja context
combined_context AS (
    SELECT
        jsonb_build_object(
            'simulation', COALESCE((SELECT simulation_data FROM simulation_context), '{}'::jsonb),
            'scenario', COALESCE((SELECT scenario_data FROM scenario_context), '{}'::jsonb),
            'current', jsonb_build_object(
                'problem_statement', (SELECT problem_statement FROM current_content),
                'objectives', COALESCE((SELECT objectives FROM current_content), '[]'::jsonb),
                'persona', (SELECT persona FROM current_content)
            ),
            'available', jsonb_build_object(
                'problem_statements', COALESCE((SELECT problem_statements FROM available_resources), '[]'::jsonb),
                'objectives', COALESCE((SELECT objectives FROM available_resources), '[]'::jsonb),
                'personas', COALESCE((SELECT personas FROM available_resources), '[]'::jsonb)
            )
        ) as jinja_context
),
-- Context data with agent/model config
context_data AS (
    SELECT
        -- Agent data
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,

        -- Model data (models_resource.value contains the model name directly)
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider_name,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,

        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,

        -- Developer instruction templates
        COALESCE(did.developer_instruction_templates, ARRAY[]::text[]) as developer_instruction_templates

    FROM selected_agent sa
    INNER JOIN agent_artifact a ON a.id = sa.agent_id

    -- Agent prompt
    LEFT JOIN agent_prompts_junction ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ap_default.prompt_id

    -- Model: agent_models_junction.model_id -> model_artifact -> model_models_junction -> models_resource
    INNER JOIN agent_models_junction am ON am.agent_id = a.id
    INNER JOIN model_artifact ma ON ma.id = am.model_id
    INNER JOIN model_models_junction mmj ON mmj.model_id = ma.id
    INNER JOIN models_resource m ON m.id = mmj.models_id

    -- Temperature (uses model_artifact.id)
    LEFT JOIN agent_temperature_levels_junction atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels_junction mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = ma.id
    LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true

    -- Reasoning (uses model_artifact.id)
    LEFT JOIN agent_reasoning_levels_junction arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels_junction mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = ma.id
    LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true

    -- Endpoint/base_url (uses model_artifact.id)
    LEFT JOIN model_endpoints_junction me_j ON me_j.model_id = ma.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true

    -- API key via provider -> settings -> keys (uses model_artifact.id)
    LEFT JOIN model_providers_junction mp ON mp.model_id = ma.id
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

    -- Tools
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id

    -- Developer instructions
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
)
SELECT
    cr.run_id,
    gd.group_id,
    gd.trace_id::text as trace_id,
    rs.scenario_id,
    -- Agent context
    cd.agent_name,
    cd.system_prompt,
    -- Model context
    cd.model_name,
    cd.provider_name,
    cd.base_url,
    cd.api_key,
    cd.temperature,
    cd.reasoning,
    -- Tools
    cd.tools,
    -- Developer instruction templates (raw)
    cd.developer_instruction_templates,
    -- Jinja context
    cc.jinja_context
FROM create_run cr
CROSS JOIN group_data gd
CROSS JOIN resolved_scenario rs
CROSS JOIN context_data cd
CROSS JOIN combined_context cc
$$;
