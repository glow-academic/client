-- Query: get_profile_summary_view
-- Purpose: Per-profile aggregate counts for the activity summary card

-- Step 1: Drop existing function
DO $$ BEGIN
    PERFORM p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'api_get_profile_summary_view_v4';
    IF FOUND THEN
        EXECUTE 'DROP FUNCTION public.api_get_profile_summary_view_v4';
    END IF;
END $$;

-- Step 2: Drop existing composite types
DO $$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT typname FROM pg_type
             JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid
             WHERE nspname = 'types' AND typname LIKE 'q_get_profile_summary_view_v4_%'
    LOOP EXECUTE format('DROP TYPE types.%I CASCADE', r.typname); END LOOP;
END $$;

-- Step 3: Create composite type

CREATE TYPE types.q_get_profile_summary_view_v4_item AS (
    profile_id uuid,
    sessions_count int,
    logins_count int,
    grants_count int,
    problems_count int,
    activity_count int
);

-- Step 4: Create function

CREATE OR REPLACE FUNCTION api_get_profile_summary_view_v4(
    profile_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_profile_summary_view_v4_item[]
)
LANGUAGE sql STABLE
AS $$
    WITH
    session_counts AS (
        SELECT profile_id, COUNT(*)::int AS cnt
        FROM sessions_mv
        WHERE (profile_id_filter IS NULL OR profile_id = profile_id_filter)
        GROUP BY profile_id
    ),
    login_counts AS (
        SELECT profile_id, COUNT(*)::int AS cnt
        FROM logins_mv
        WHERE (profile_id_filter IS NULL OR profile_id = profile_id_filter)
        GROUP BY profile_id
    ),
    grant_counts AS (
        SELECT grantor_id AS profile_id, COUNT(*)::int AS cnt
        FROM grants_mv
        WHERE (profile_id_filter IS NULL OR grantor_id = profile_id_filter)
        GROUP BY grantor_id
    ),
    problem_counts AS (
        SELECT profile_id, COUNT(*)::int AS cnt
        FROM problems_mv
        WHERE (profile_id_filter IS NULL OR profile_id = profile_id_filter)
        GROUP BY profile_id
    ),
    activity_counts AS (
        SELECT profile_id, COUNT(*)::int AS cnt
        FROM activity_mv
        WHERE (profile_id_filter IS NULL OR profile_id = profile_id_filter)
        GROUP BY profile_id
    ),
    all_profiles AS (
        SELECT profile_id FROM session_counts
        UNION SELECT profile_id FROM login_counts
        UNION SELECT profile_id FROM grant_counts
        UNION SELECT profile_id FROM problem_counts
        UNION SELECT profile_id FROM activity_counts
    ),
    combined AS (
        SELECT
            ap.profile_id,
            COALESCE(sc.cnt, 0) AS sessions_count,
            COALESCE(lc.cnt, 0) AS logins_count,
            COALESCE(gc.cnt, 0) AS grants_count,
            COALESCE(pc.cnt, 0) AS problems_count,
            COALESCE(ac.cnt, 0) AS activity_count
        FROM all_profiles ap
        LEFT JOIN session_counts sc ON sc.profile_id = ap.profile_id
        LEFT JOIN login_counts lc ON lc.profile_id = ap.profile_id
        LEFT JOIN grant_counts gc ON gc.profile_id = ap.profile_id
        LEFT JOIN problem_counts pc ON pc.profile_id = ap.profile_id
        LEFT JOIN activity_counts ac ON ac.profile_id = ap.profile_id
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (profile_id, sessions_count, logins_count, grants_count, problems_count, activity_count)
                ::types.q_get_profile_summary_view_v4_item
            ),
            ARRAY[]::types.q_get_profile_summary_view_v4_item[]
        ) AS items
        FROM combined
    )
    SELECT items FROM items_agg;
$$;
