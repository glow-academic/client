-- Get sessions list with pagination
-- Converted to function with composite types
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
        WHERE proname = 'api_get_activity_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_list_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_activity_list_v4_session AS (
    session_id uuid,
    created_at timestamptz,
    profile_name text,
    profile_id uuid,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_activity_list_v4(
    profile_id uuid,
    page integer DEFAULT 0,
    page_size integer DEFAULT 50,
    search text DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    sessions types.q_get_activity_list_v4_session[],
    total_count bigint,
    page integer,
    page_size integer,
    total_pages integer
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        page AS page,
        page_size AS page_size,
        COALESCE(NULLIF(search, ''), NULL) AS search,
        (page * page_size) AS offset_value
),
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
filtered_sessions AS (
    SELECT
        s.id as session_id,
        s.created_at,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = s.profile_id LIMIT 1), 'Anonymous') as profile_name,
        s.profile_id,
        s.active
    FROM view_sessions_entry s
    CROSS JOIN params x
    WHERE (x.search IS NULL OR x.search = '' OR COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = s.profile_id LIMIT 1), 'Anonymous') ILIKE '%' || x.search || '%')
),
session_count AS (
    SELECT COUNT(*) as total_count
    FROM filtered_sessions
),
paginated_sessions AS (
    SELECT
        fs.session_id,
        fs.created_at,
        fs.profile_name,
        fs.profile_id,
        fs.active
    FROM filtered_sessions fs
    CROSS JOIN params x
    ORDER BY fs.created_at DESC
    LIMIT (SELECT page_size FROM params LIMIT 1)
    OFFSET (SELECT offset_value FROM params LIMIT 1)
)
SELECT
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (ps.session_id, ps.created_at, ps.profile_name, ps.profile_id, ps.active)::types.q_get_activity_list_v4_session
            ORDER BY ps.created_at DESC
        ),
        '{}'::types.q_get_activity_list_v4_session[]
    ) as sessions,
    sc.total_count,
    p.page,
    p.page_size,
    CASE
        WHEN p.page_size > 0 THEN (sc.total_count + p.page_size - 1) / p.page_size
        ELSE 0
    END as total_pages
FROM user_profile up
CROSS JOIN params p
CROSS JOIN session_count sc
LEFT JOIN paginated_sessions ps ON true
GROUP BY up.actor_name, sc.total_count, p.page, p.page_size
$$;
