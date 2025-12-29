-- Get activity list with pagination
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_activity_list_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_list_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_list_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_activity_list_v3_activity AS (
    activity_id uuid,           -- Native uuid, not text
    created_at timestamptz,      -- Native timestamptz, not text
    message text,
    error boolean,
    profile_name text,
    profile_id uuid              -- Native uuid, not text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_activity_list_v3(
    profile_id uuid,
    page integer DEFAULT 0,
    page_size integer DEFAULT 50,
    search text DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    activities types.q_get_activity_list_v3_activity[],
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
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
filtered_activities AS (
    SELECT 
        a.id as activity_id,
        a.created_at,
        a.message,
        a.error,
        COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') as profile_name,
        p.id as profile_id
    FROM activity a
    LEFT JOIN profiles p ON p.id = a.profile_id
    CROSS JOIN params x
    WHERE (x.search IS NULL OR x.search = '' OR a.message ILIKE '%' || x.search || '%' OR COALESCE(p.first_name || ' ' || p.last_name, 'Anonymous') ILIKE '%' || x.search || '%')
),
activity_count AS (
    SELECT COUNT(*) as total_count
    FROM filtered_activities
),
paginated_activities AS (
    SELECT 
        fa.activity_id,
        fa.created_at,
        fa.message,
        fa.error,
        fa.profile_name,
        fa.profile_id
    FROM filtered_activities fa
    CROSS JOIN params x
    ORDER BY fa.created_at DESC
    LIMIT (SELECT page_size FROM params LIMIT 1)
    OFFSET (SELECT offset_value FROM params LIMIT 1)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (pa.activity_id, pa.created_at, pa.message, pa.error, pa.profile_name, pa.profile_id)::types.q_get_activity_list_v3_activity
            ORDER BY pa.created_at DESC
        ),
        '{}'::types.q_get_activity_list_v3_activity[]
    ) as activities,
    ac.total_count,
    p.page,
    p.page_size,
    CASE 
        WHEN p.page_size > 0 THEN (ac.total_count + p.page_size - 1) / p.page_size
        ELSE 0
    END as total_pages
FROM user_profile up
CROSS JOIN params p
CROSS JOIN activity_count ac
LEFT JOIN paginated_activities pa ON true
GROUP BY up.actor_name, ac.total_count, p.page, p.page_size
$$;

COMMIT;

