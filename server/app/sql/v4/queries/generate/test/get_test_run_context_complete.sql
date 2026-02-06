-- Get context data for test run validation
-- Returns chat state, group config (agent, model, API key), and pending run info

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_test_run_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_test_run_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_test_run_context_v4(
    p_profile_id uuid,
    p_chat_id uuid
)
RETURNS TABLE (
    -- Chat context
    chat_exists boolean,
    chat_is_active boolean,
    chat_id uuid,

    -- Attempt context
    attempt_exists boolean,
    attempt_id uuid,

    -- Group context (for config)
    group_exists boolean,
    group_id uuid,

    -- Agent context (from group)
    agent_exists boolean,
    agent_name text,
    agent_is_active boolean,
    agent_id uuid,

    -- Model context (from group)
    model_id uuid,
    model_name text,

    -- Provider context (from group)
    provider_id uuid,
    provider_name text,

    -- API key context
    has_api_key boolean,

    -- Rate limit context
    requests_per_day integer,
    runs_today bigint,

    -- Run state
    has_pending_runs boolean,
    next_run_resource_id uuid,
    total_runs integer,
    completed_runs integer,

    -- Rubric
    rubric_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id AS profile_id,
        p_chat_id AS chat_id
),
-- Chat data
chat_data AS (
    SELECT
        c.id as chat_id,
        TRUE as chat_exists,
        c.active as chat_is_active,
        c.attempt_id
    FROM benchmark_chats_entry c
    CROSS JOIN params p
    WHERE c.id = p.chat_id
    LIMIT 1
),
-- Attempt data
attempt_data AS (
    SELECT
        t.id as attempt_id,
        TRUE as attempt_exists
    FROM benchmark_tests_entry t
    JOIN chat_data cd ON cd.attempt_id = t.id
    WHERE t.active = true
    LIMIT 1
),
-- Group binding data (runtime config)
group_binding AS (
    SELECT
        b.group_id,
        TRUE as group_exists
    FROM benchmark_chats_bindings_entry b
    JOIN chat_data cd ON b.chat_id = cd.chat_id
    WHERE b.active = true
    LIMIT 1
),
-- Agent from group
agent_data AS (
    SELECT
        a.id as agent_id,
        TRUE as agent_exists,
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        EXISTS (
            SELECT 1 FROM agent_flags_junction af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true
        ) as agent_is_active
    FROM groups_agents_connection gac
    JOIN group_binding gb ON gac.group_id = gb.group_id
    JOIN agents_resource ar ON ar.id = gac.agents_id
    JOIN agent_artifact a ON a.id = ar.id
    WHERE gac.active = true
    LIMIT 1
),
-- Model from group
model_data AS (
    SELECT
        m.id as model_id,
        (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name
    FROM groups_models_connection gmc
    JOIN group_binding gb ON gmc.group_id = gb.group_id
    JOIN models_resource m ON m.id = gmc.models_id
    WHERE gmc.active = true
    LIMIT 1
),
-- Provider from model
provider_data AS (
    SELECT
        pr.id as provider_id,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as provider_name
    FROM model_providers_junction mp
    JOIN model_data md ON mp.model_id = md.model_id
    JOIN providers_resource prov ON prov.id = mp.providers_id
    JOIN provider_providers_junction ppj ON ppj.providers_id = prov.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    LIMIT 1
),
-- API key from group
api_key_data AS (
    SELECT
        TRUE as has_api_key
    FROM groups_keys_connection gkc
    JOIN group_binding gb ON gkc.group_id = gb.group_id
    JOIN keys_resource k ON k.id = gkc.keys_id AND k.active = true
    WHERE gkc.active = true
    LIMIT 1
),
-- Rate limit data
profile_rate_limit AS (
    SELECT
        rl.requests_per_day as req_per_day
    FROM params p
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.profile_id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
runs_today AS (
    SELECT
        COUNT(*)::bigint as runs_today_count
    FROM view_runs_entry mr
    JOIN profile_runs_junction prj ON prj.run_id = mr.id
    CROSS JOIN params p
    WHERE prj.profile_id = p.profile_id
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Runs linked to this chat
chat_runs AS (
    SELECT
        r.runs_id as run_resource_id,
        r.created_at
    FROM benchmark_chats_runs_connection r
    JOIN chat_data cd ON r.chat_id = cd.chat_id
    WHERE r.active = true
    ORDER BY r.created_at ASC
),
-- Count total and completed runs
run_counts AS (
    SELECT
        COUNT(*)::integer as total_runs,
        0::integer as completed_runs  -- TODO: Track completed runs
    FROM chat_runs
),
-- Next pending run (first by created_at that hasn't been replayed)
next_pending AS (
    SELECT
        cr.run_resource_id
    FROM chat_runs cr
    -- TODO: LEFT JOIN to check if already replayed
    LIMIT 1
),
-- Rubric from run or group
rubric_data AS (
    SELECT
        rr.rubric_id
    FROM run_rubrics_resource rr
    JOIN next_pending np ON rr.runs_id = np.run_resource_id
    WHERE rr.active = true
    LIMIT 1
)
SELECT
    -- Chat
    COALESCE(cd.chat_exists, FALSE),
    COALESCE(cd.chat_is_active, FALSE),
    cd.chat_id,

    -- Attempt
    COALESCE(ad.attempt_exists, FALSE),
    ad.attempt_id,

    -- Group
    COALESCE(gb.group_exists, FALSE),
    gb.group_id,

    -- Agent
    COALESCE(agd.agent_exists, FALSE),
    agd.agent_name,
    COALESCE(agd.agent_is_active, FALSE),
    agd.agent_id,

    -- Model
    md.model_id,
    md.model_name,

    -- Provider
    pd.provider_id,
    pd.provider_name,

    -- API key
    COALESCE(ak.has_api_key, FALSE),

    -- Rate limit
    prl.req_per_day,
    COALESCE(rt.runs_today_count, 0),

    -- Runs
    EXISTS (SELECT 1 FROM next_pending),
    np.run_resource_id,
    COALESCE(rc.total_runs, 0),
    COALESCE(rc.completed_runs, 0),

    -- Rubric
    rd.rubric_id

FROM params p
LEFT JOIN chat_data cd ON true
LEFT JOIN attempt_data ad ON true
LEFT JOIN group_binding gb ON true
LEFT JOIN agent_data agd ON true
LEFT JOIN model_data md ON true
LEFT JOIN provider_data pd ON true
LEFT JOIN api_key_data ak ON true
LEFT JOIN profile_rate_limit prl ON true
LEFT JOIN runs_today rt ON true
LEFT JOIN run_counts rc ON true
LEFT JOIN next_pending np ON true
LEFT JOIN rubric_data rd ON true
$$;
