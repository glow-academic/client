-- Get all data needed to run video agent AND create run in single atomic transaction
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
        WHERE proname = 'socket_get_video_run_context_and_create_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_video_run_context_and_create_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_video_run_context_and_create_run_v4(
    video_id uuid,
    profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
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
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    department_id uuid,
    run_id text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    -- Explicitly cast parameters for asyncpg type inference
    SELECT video_id::uuid as video_id, profile_id::uuid as profile_id
),
video_department AS (
    SELECT
        NULL::uuid as department_id,
        v.id as video_id
    FROM params p
    JOIN videos_resource v ON v.id = p.video_id
    LIMIT 1
),
best_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN video_department vd
    WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    AND (
        -- Include if agent is linked to the video's department
        (vd.department_id IS NOT NULL AND ad.department_id = vd.department_id)
        -- OR agent has no department links (cross-department)
        OR NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
        -- OR video has no department links (cross-department video)
        OR vd.department_id IS NULL
    )
    ORDER BY 
        -- Prioritize department-specific agents over cross-department agents
        CASE WHEN vd.department_id IS NOT NULL AND ad.department_id = vd.department_id THEN 0 ELSE 1 END
    LIMIT 1
),
profile_rate_limit AS (
    -- Get rate limit for the profile (or NULL if profile_id is NULL)
    SELECT 
        rl.requests_per_day as req_per_day
    FROM params p
    LEFT JOIN profile_artifact prof ON prof.id = p.profile_id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = prof.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE p.profile_id IS NOT NULL
),
runs_today AS (
    -- Count model view_runs_entry for the profile since start of day (or 0 if profile_id is NULL)
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM params p
    LEFT JOIN profiles_runs_connection prj ON prj.profiles_id = p.profile_id
    LEFT JOIN view_runs_entry mr ON mr.id = prj.run_id
    WHERE p.profile_id IS NOT NULL
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
context_data AS (
    -- Get all context data (agent, model, provider, etc.)
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,
        COALESCE(a.temperature, 0.0) as temperature,
        a.reasoning as reasoning,

        -- Model data
        m.id::text as model_id,
        m.value as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(pr.endpoint, '') as base_url,
        pr.key as api_key,

        -- Custom model (if any) - indicated by presence of endpoint on providers_resource
        CASE WHEN pr.endpoint IS NOT NULL AND pr.endpoint != '' THEN m.value ELSE NULL END as custom_model,
        
        -- Provider data (provider enum is now on models table, no separate providers table)
        NULL::text as provider_id,
        COALESCE(n_prov.name, '') as provider_name,
        
        -- Profile data
        p.profile_id::text as profile_id,
        
        -- Rate limit data (for profile) - use COALESCE to handle NULL profile_id
        COALESCE(prl.req_per_day, 0) as req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Department ID (from video_department, for agent selection)
        vd.department_id

    FROM best_agent ba
    INNER JOIN agents_resource a ON a.id = ba.agent_id
    CROSS JOIN params p
    CROSS JOIN video_department vd
    LEFT JOIN agent_prompts_junction ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ap_default.prompt_id
    INNER JOIN models_resource m ON m.id = a.model_id
    -- Get provider via models_resource.provider_id
    LEFT JOIN providers_resource pr ON pr.id = m.provider_id
    LEFT JOIN provider_providers_junction ppj ON ppj.providers_id = pr.id
    LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = ppj.provider_id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    LEFT JOIN profile_rate_limit prl ON TRUE
    LEFT JOIN runs_today rt ON TRUE
),
create_run AS (
    -- Create run record (atomic with context query)
    INSERT INTO runs_entry (input_tokens, output_tokens)
    SELECT 0, 0
    FROM context_data cd
    RETURNING id
),
link_run_to_profile AS (
    -- Link run to profile via junction table
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT cd.profile_id::uuid, cr.id
    FROM context_data cd
    CROSS JOIN create_run cr
    WHERE cd.profile_id IS NOT NULL
)
SELECT
    -- Context data
    cd.agent_id,
    cd.agent_name,
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
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    cd.department_id,
    -- Run ID (created in same transaction)
    cr.id::text as run_id
FROM context_data cd
CROSS JOIN create_run cr
$$;