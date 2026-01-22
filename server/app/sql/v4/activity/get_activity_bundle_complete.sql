-- Get activity bundle with header metrics and chart data
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
CREATE TYPE types.q_get_activity_bundle_v4_chart_data_point AS (
    date date,
    active_profiles integer,
    feedback_entries integer,
    activity_entries integer,
    errors integer
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_activity_bundle_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    active_profiles_count bigint,
    total_feedback_count bigint,
    total_activity_entries bigint,
    total_errors_count bigint,
    chart_data types.q_get_activity_bundle_v4_chart_data_point[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
),
daily_activity AS (
    SELECT
        DATE(created_at) as date,
        COUNT(*) as activity_count,
        COUNT(*) FILTER (WHERE error = true) as error_count
    FROM audits
    WHERE created_at >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(created_at)
),
daily_feedback AS (
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as feedback_count
    FROM problems_entry
    WHERE created_at >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(created_at)
),
daily_active_profiles AS (
    SELECT
        DATE(last_active) as date,
        COUNT(DISTINCT profile_id) as active_profiles_count
    FROM activity
    WHERE last_active >= NOW() - INTERVAL '90 days'
    GROUP BY DATE(last_active)
),
date_series AS (
    SELECT generate_series(
        DATE(NOW() - INTERVAL '90 days'),
        DATE(NOW()),
        '1 day'::interval
    )::date as date
),
combined_daily AS (
    SELECT 
        ds.date,
        COALESCE(da.activity_count, 0) as activity_count,
        COALESCE(da.error_count, 0) as error_count,
        COALESCE(df.feedback_count, 0) as feedback_count,
        COALESCE(dap.active_profiles_count, 0) as active_profiles_count
    FROM date_series ds
    LEFT JOIN daily_activity da ON ds.date = da.date
    LEFT JOIN daily_feedback df ON ds.date = df.date
    LEFT JOIN daily_active_profiles dap ON ds.date = dap.date
    ORDER BY ds.date
)
SELECT
    up.actor_name::text as actor_name,
    (SELECT COUNT(DISTINCT profile_id) FROM activity)::bigint as active_profiles_count,
    (SELECT COUNT(*) FROM problems_entry)::bigint as total_feedback_count,
    (SELECT COUNT(*) FROM audits)::bigint as total_activity_entries,
    (SELECT COUNT(*) FROM audits WHERE error = true)::bigint as total_errors_count,
    COALESCE(
        ARRAY_AGG(
            (cd.date, cd.active_profiles_count::integer, cd.feedback_count::integer, cd.activity_count::integer, cd.error_count::integer)::types.q_get_activity_bundle_v4_chart_data_point
            ORDER BY cd.date
        ),
        '{}'::types.q_get_activity_bundle_v4_chart_data_point[]
    ) as chart_data
FROM user_profile up
CROSS JOIN combined_daily cd
GROUP BY up.actor_name
$$;
