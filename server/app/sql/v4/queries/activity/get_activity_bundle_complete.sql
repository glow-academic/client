-- Get activity bundle with header metrics, dynamic event chart data, and problems
-- Converted to function with composite types (no JSONB)
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
        WHERE proname = 'api_get_activity_bundle_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_bundle_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_bundle_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_activity_bundle_v4_event_type AS (
    id text,
    name text,
    total_count integer
);

CREATE TYPE types.q_get_activity_bundle_v4_chart_point AS (
    date date,
    event_id text,
    count integer
);

CREATE TYPE types.q_get_activity_bundle_v4_problem AS (
    problem_id uuid,
    type text,
    message text,
    resolved boolean,
    created_at timestamptz,
    profile_name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_activity_bundle_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    sessions_count bigint,
    active_profiles_count bigint,
    logins_count bigint,
    content_created_count bigint,
    available_events types.q_get_activity_bundle_v4_event_type[],
    chart_data types.q_get_activity_bundle_v4_chart_point[],
    problems types.q_get_activity_bundle_v4_problem[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Header stats
sessions_total AS (
    SELECT COUNT(*) as cnt FROM sessions_entry
),
active_profiles_total AS (
    SELECT COUNT(DISTINCT profile_id) as cnt FROM profile_activity_junction
),
logins_total AS (
    SELECT COUNT(*) as cnt FROM logins_entry
),
content_created_total AS (
    SELECT COUNT(*) as cnt FROM audits_entry
    WHERE endpoint LIKE '%.saved' OR endpoint LIKE '%.created' OR endpoint LIKE '%.duplicated' OR endpoint LIKE '%.uploaded'
),
-- Available events: distinct endpoints from last 90 days
event_counts AS (
    SELECT
        endpoint as id,
        INITCAP(REPLACE(endpoint, '.', ' ')) as name,
        COUNT(*)::integer as total_count
    FROM audits_entry
    WHERE created_at >= NOW() - INTERVAL '90 days'
      AND endpoint IS NOT NULL
      AND endpoint != ''
    GROUP BY endpoint
    ORDER BY COUNT(*) DESC
    LIMIT 20
),
-- Chart data: daily counts per event over 90 days
date_series AS (
    SELECT generate_series(
        DATE(NOW() - INTERVAL '90 days'),
        DATE(NOW()),
        '1 day'::interval
    )::date as date
),
chart_points AS (
    SELECT
        ds.date,
        ec.id as event_id,
        COALESCE(daily.cnt, 0)::integer as count
    FROM date_series ds
    CROSS JOIN event_counts ec
    LEFT JOIN (
        SELECT DATE(created_at) as date, endpoint, COUNT(*)::integer as cnt
        FROM audits_entry
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND endpoint IS NOT NULL
        GROUP BY DATE(created_at), endpoint
    ) daily ON daily.date = ds.date AND daily.endpoint = ec.id
),
-- Problems
problems_list AS (
    SELECT
        pe.id as problem_id,
        pe.type,
        pe.message,
        pe.resolved,
        pe.created_at,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = ppj.profile_id LIMIT 1), 'Anonymous') as profile_name
    FROM problems_entry pe
    LEFT JOIN profile_problems_junction ppj ON ppj.problem_id = pe.id
    ORDER BY pe.created_at DESC
    LIMIT 50
)
SELECT
    up.actor_name::text as actor_name,
    (SELECT cnt FROM sessions_total)::bigint as sessions_count,
    (SELECT cnt FROM active_profiles_total)::bigint as active_profiles_count,
    (SELECT cnt FROM logins_total)::bigint as logins_count,
    (SELECT cnt FROM content_created_total)::bigint as content_created_count,
    COALESCE(
        (SELECT ARRAY_AGG((ec.id, ec.name, ec.total_count)::types.q_get_activity_bundle_v4_event_type) FROM event_counts ec),
        '{}'::types.q_get_activity_bundle_v4_event_type[]
    ) as available_events,
    COALESCE(
        (SELECT ARRAY_AGG((cp.date, cp.event_id, cp.count)::types.q_get_activity_bundle_v4_chart_point ORDER BY cp.date, cp.event_id) FROM chart_points cp),
        '{}'::types.q_get_activity_bundle_v4_chart_point[]
    ) as chart_data,
    COALESCE(
        (SELECT ARRAY_AGG((pl.problem_id, pl.type, pl.message, pl.resolved, pl.created_at, pl.profile_name)::types.q_get_activity_bundle_v4_problem ORDER BY pl.created_at DESC) FROM problems_list pl),
        '{}'::types.q_get_activity_bundle_v4_problem[]
    ) as problems
FROM user_profile up
$$;
