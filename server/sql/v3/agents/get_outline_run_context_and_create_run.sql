-- Get all data needed to run outline agent AND create run in single atomic transaction
-- Parameters: $1=department_id (uuid), $2=document_ids[] (uuid array), $3=question_ids[] (uuid array), $4=parameter_item_ids[] (uuid array), $5=profile_id (uuid, nullable), $6=video_id (uuid, nullable)
-- Returns: agent, model, provider, documents (policies), questions, parameter_items, video_length, profile data, AND run_id
-- Validates rate limit and creates run atomically - if run creation fails, entire transaction rolls back
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT $1::uuid as department_id, $2::uuid[] as document_ids, $3::uuid[] as question_ids, $4::uuid[] as parameter_item_ids, $5::uuid as profile_id, $6::uuid as video_id
),
-- Get policy field ID for filtering
policy_param_item AS (
    SELECT f.id
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters p ON p.id = fp.parameter_id
    WHERE p.name = 'Document Type' AND p.document_parameter = true
    AND f.value = 'policy'
    LIMIT 1
),
video_info AS (
    -- Get video length if video_id is provided
    SELECT 
        v.length_seconds,
        -- If video_id provided and no question_ids, get questions from video
        CASE 
            WHEN p.video_id IS NOT NULL AND (p.question_ids IS NULL OR array_length(p.question_ids, 1) IS NULL) THEN
                (SELECT ARRAY_AGG(vq.question_id)
                 FROM video_questions vq
                 WHERE vq.video_id = p.video_id AND vq.active = true)
            ELSE p.question_ids
        END as effective_question_ids
    FROM params p
    LEFT JOIN videos v ON v.id = p.video_id
),
default_guest AS (
    -- Get default guest profile from settings system
    SELECT sdg.profile_id::text as guest_profile_id
    FROM settings_default_guest sdg
    JOIN settings s ON s.id = sdg.settings_id AND s.active = true
    WHERE sdg.active = true
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN params p
    WHERE a.role = 'outline'
    AND a.active = true
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
final_profile AS (
    -- Use provided profile_id or default guest profile
    SELECT COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT guest_profile_id::uuid FROM default_guest)
    ) as final_profile_id
),
profile_rate_limit AS (
    -- Get rate limit for the final profile (provided or default guest)
    SELECT 
        prl.requests_per_day as req_per_day
    FROM profiles prof
    LEFT JOIN profile_request_limits prl ON prl.profile_id = prof.id AND prl.active = true
    WHERE prof.id = (SELECT final_profile_id FROM final_profile)
),
runs_today AS (
    -- Count model runs for the final profile since start of day
    SELECT 
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mrp.profile_id = (SELECT final_profile_id FROM final_profile)
      AND mrp.active = true
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
resolved_profile_for_settings AS (
    SELECT COALESCE(
        (SELECT profile_id FROM params WHERE profile_id IS NOT NULL),
        (SELECT guest_profile_id::uuid FROM default_guest)
    ) as profile_id
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
profile_primary_department AS (
    SELECT pd.department_id
    FROM resolved_profile_for_settings rpfs
    JOIN profile_departments pd ON pd.profile_id = rpfs.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM settings s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE s.active = true 
      AND sd.active = true
    LIMIT 1
),
active_settings AS (
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM settings WHERE active = true LIMIT 1)
        ) as settings_id
),
context_data AS (
    -- Get all context data (agent, model, provider, documents, questions, etc.)
    SELECT 
        -- Agent data
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
        
        -- Documents (policies) data (aggregated as JSON array)
        -- Include file_path and mime_type so format_policy_info can read actual PDF content
        COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', d.id::text,
                    'name', d.name,
                    'content', '',
                    'file_path', u.file_path,
                    'mime_type', u.mime_type
                )
                ORDER BY array_position(p.document_ids, d.id)
            )
            FROM documents d
            LEFT JOIN document_uploads du ON du.document_id = d.id AND du.active = true
            LEFT JOIN uploads u ON u.id = du.upload_id
            CROSS JOIN policy_param_item ppi
            JOIN document_fields df ON df.document_id = d.id AND df.field_id = ppi.id AND df.active = true
            WHERE d.id = ANY(p.document_ids) AND d.active = true
            ),
            '[]'::json
        ) as policies,
        
        -- Questions data (aggregated as JSON array)
        -- Use effective_question_ids from video_info if video_id provided
        COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', q.id::text,
                    'question_text', q.question_text,
                    'allow_multiple', q.allow_multiple
                )
                ORDER BY array_position(vi.effective_question_ids, q.id)
            )
            FROM video_info vi
            CROSS JOIN params p
            LEFT JOIN questions q ON q.id = ANY(vi.effective_question_ids)
            WHERE vi.effective_question_ids IS NOT NULL AND q.id IS NOT NULL
            ),
            '[]'::json
        ) as questions,
        
        -- Parameter items data (aggregated as JSON array with parameter info)
        COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'item_name', pi.name,
                    'item_description', pi.description,
                    'param_name', pa.name,
                    'param_description', pa.description
                )
                ORDER BY array_position(p.parameter_item_ids, pi.id)
            )
            FROM fields f
            JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
            JOIN parameters pa ON pa.id = fp.parameter_id
            WHERE f.id = ANY(p.parameter_item_ids)
            ),
            '[]'::json
        ) as parameter_items,
        
        -- Personas data (aggregated as JSON array when video_id provided)
        COALESCE(
            (SELECT json_agg(
                json_build_object(
                    'id', p.id::text,
                    'name', p.name,
                    'description', COALESCE(p.description, '')
                )
                ORDER BY vp.persona_id
            )
            FROM video_personas vp
            JOIN personas p ON p.id = vp.persona_id
            CROSS JOIN params p_params
            WHERE vp.video_id = p_params.video_id AND vp.active = true AND p.active = true
            ),
            '[]'::json
        ) FILTER (WHERE (SELECT video_id FROM params) IS NOT NULL) as personas,
        
        -- Video length (if video_id provided)
        vi.length_seconds as video_length_seconds,
        
        -- Profile data (use provided profile_id or default guest)
        COALESCE(
            (SELECT profile_id::text FROM params WHERE profile_id IS NOT NULL),
            dg.guest_profile_id
        ) as profile_id,
        
        -- Default guest profile
        dg.guest_profile_id as default_guest_profile_id,
        
        -- Rate limit data (for final profile)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Final profile ID
        fp.final_profile_id

    FROM best_agent ba
    INNER JOIN agents a ON a.id = ba.agent_id
    CROSS JOIN params p
    CROSS JOIN video_info vi
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
    CROSS JOIN default_guest dg
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    CROSS JOIN final_profile fp
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
    -- Link profile to run if provided (conditional)
    INSERT INTO run_profiles (run_id, profile_id, active)
    SELECT lm.run_id, cd.final_profile_id, true
    FROM link_model lm
    CROSS JOIN context_data cd
    WHERE cd.final_profile_id IS NOT NULL
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
    cd.custom_model,
    cd.provider_id,
    cd.provider_name,
    cd.policies,
    cd.questions,
    cd.parameter_items,
    cd.personas,
    cd.video_length_seconds,
    cd.profile_id,
    cd.default_guest_profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Run ID (created in same transaction)
    cr.id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr

