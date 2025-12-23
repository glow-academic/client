-- Generate hints for a simulation message - complete unit of work
-- Parameters: $1=message_id (uuid), $2=chat_id (uuid), $3=department_id (uuid)
-- This SQL file handles: context fetching, run creation (with rate limit check), and returns all needed data
-- Note: Hint storage happens in Python after agent execution
-- Returns: All context data needed for hint generation, plus run_id if created

WITH target_message AS (
    SELECT m.id, c.id AS chat_id, m.role, mc.content, m.created_at
    FROM messages m
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN runs r ON r.id = mr.run_id
    JOIN group_runs gr ON gr.run_id = r.id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chats c ON c.id = cg.chat_id
    WHERE m.id = $1::uuid AND c.id = $2::uuid
),
chat_info AS (
    SELECT sc.id, ac.attempt_id, sc.scenario_id, sc.trace_id, sc.title
    FROM chats sc
    JOIN attempt_chats ac ON ac.chat_id = sc.id
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
    SELECT ap.profile_id
    FROM attempt_profiles ap
    JOIN attempt_info ai ON ai.id = ap.attempt_id
    WHERE ap.active = true
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.role = 'hint'
    AND a.active = true
    AND (
        -- Include if agent is linked to the specified department
        ad.department_id = $3::uuid
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN ad.department_id = $3::uuid THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (via attempt_profiles)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT profile_id FROM profile_info)
),
runs_today AS (
    -- Count model runs for this profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT profile_id FROM profile_info)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
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
-- Context data with rate limit info
context_data AS (
    SELECT 
        tm.id::text as message_id,
        tm.created_at as message_created_at,
        ci.id::text as chat_id,
        ci.attempt_id::text,
        ci.scenario_id::text,
        ci.trace_id,
        ci.title as chat_title,
        ai.id::text as attempt_id,
        ai.simulation_id::text,
        si.problem_statement,
        a.id::text as agent_id,
        a.name as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(mtl.temperature, 0.0) as temperature,
        mrl.reasoning_level as reasoning,
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(p.value::text, '') as provider_name,
        COALESCE(me.base_url, '') as base_url,
        k.key as api_key,
        m.custom_model as custom_model,
        p.id::text as provider_id,
        pi.profile_id::text,
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'id', d.id::text,
                        'name', d.name,
                        'file_path', u.file_path,
                        'mime_type', u.mime_type
                    )
                    ORDER BY d.id
                )
                FROM scenario_documents sd
                JOIN documents d ON d.id = sd.document_id
                LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
                LEFT JOIN uploads u ON u.id = du.upload_id
                WHERE sd.scenario_id = si.id AND sd.active = true
            ),
            '[]'::json
        ) as documents
    FROM target_message tm
    CROSS JOIN chat_info ci
    CROSS JOIN attempt_info ai
    CROSS JOIN scenario_info si
    LEFT JOIN profile_info pi ON true
    CROSS JOIN best_agent ba
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    INNER JOIN agents a ON a.id = ba.agent_id
    LEFT JOIN agent_department_prompts adp_prompt ON adp_prompt.agent_id = a.id AND adp_prompt.department_id = $3::uuid AND adp_prompt.active = true
    LEFT JOIN prompts pr_prompt_dept ON pr_prompt_dept.id = adp_prompt.prompt_id
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts pr_prompt_default ON pr_prompt_default.id = ap_default.prompt_id
    LEFT JOIN prompts pr_prompt ON pr_prompt.id = COALESCE(pr_prompt_dept.id, pr_prompt_default.id)
    INNER JOIN models m ON m.id = a.model_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true AND mtl.model_id = m.id
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true AND mrl.model_id = m.id
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    LEFT JOIN providers p ON p.id = m.provider_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.provider_id = p.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys k ON k.id = spk.key_id AND k.active = true
    -- Validate rate limit: raises exception if exceeded
    WHERE validate_rate_limit(prl.req_per_day, COALESCE(rt.runs_today_count, 0)) = TRUE
),
create_run AS (
    -- Create run record
    INSERT INTO runs (input_tokens, output_tokens, agent_id)
    SELECT 0, 0, cd.agent_id::uuid
    FROM context_data cd
    RETURNING id as run_id
),
link_model AS (
    -- Link model to run
    INSERT INTO run_models (run_id, model_id, active)
    SELECT cr.run_id, m.id, true
    FROM create_run cr
    CROSS JOIN best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    INNER JOIN models m ON m.id = a.model_id
    RETURNING run_id
),
link_profile AS (
    -- Link profile to run if provided
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.profile_id::uuid, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.profile_id IS NOT NULL
    RETURNING run_id
)
SELECT 
    -- Context data from context_data CTE
    cd.message_id,
    cd.message_created_at,
    cd.chat_id,
    cd.attempt_id,
    cd.scenario_id,
    cd.trace_id,
    cd.chat_title,
    cd.simulation_id,
    cd.problem_statement,
    cd.agent_id,
    cd.agent_name,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider_name,
    cd.base_url,
    cd.api_key,
    cd.custom_model,
    cd.provider_id,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    cd.documents,
    -- Run ID (created in this transaction)
    cr.run_id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr
CROSS JOIN link_model lm
CROSS JOIN link_profile lp

