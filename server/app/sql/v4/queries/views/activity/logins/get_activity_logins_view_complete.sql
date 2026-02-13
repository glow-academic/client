-- ============================================================================
-- Query: get_activity_logins_view
-- Purpose: Fetch login data from mv_activity_logins with pagination
-- Section: VIEWS/ACTIVITY/LOGINS
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_activity_logins_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_logins_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_activity_logins_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_activity_logins_view_v4_item AS (
    login_id uuid,
    profile_id uuid,
    last_login timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    active boolean,
    call_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_activity_logins_view_v4(
    profile_id_filter uuid DEFAULT NULL,
    profile_ids_filter uuid[] DEFAULT NULL,
    active_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    sort_by text DEFAULT NULL,
    sort_desc boolean DEFAULT TRUE,
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_activity_logins_view_v4_item[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_activity_logins mv
        WHERE (profile_id_filter IS NULL OR mv.profiles_id = profile_id_filter)
          AND (profile_ids_filter IS NULL OR mv.profiles_id = ANY(profile_ids_filter))
          AND (active_filter IS NULL OR mv.active = active_filter)
          AND (date_from IS NULL OR mv.last_login >= date_from)
          AND (date_to IS NULL OR mv.last_login < date_to)
    ),
    counted AS (
        SELECT COUNT(*)::bigint AS total_count FROM filtered
    ),
    paged AS (
        SELECT mv.*
        FROM filtered mv
        ORDER BY
            CASE
                WHEN sort_by IS NULL OR sort_by = 'last_login' THEN EXTRACT(EPOCH FROM mv.last_login)
                WHEN sort_by = 'created' THEN EXTRACT(EPOCH FROM mv.created_at)
                ELSE EXTRACT(EPOCH FROM mv.last_login)
            END * CASE WHEN sort_desc IS NOT FALSE THEN -1 ELSE 1 END
        LIMIT page_limit OFFSET page_offset
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    p.login_id,
                    p.profiles_id,
                    p.last_login,
                    p.created_at,
                    p.updated_at,
                    p.active,
                    p.call_id
                )::types.q_get_activity_logins_view_v4_item
                ORDER BY
                    CASE
                        WHEN sort_by IS NULL OR sort_by = 'last_login' THEN EXTRACT(EPOCH FROM p.last_login)
                        WHEN sort_by = 'created' THEN EXTRACT(EPOCH FROM p.created_at)
                        ELSE EXTRACT(EPOCH FROM p.last_login)
                    END * CASE WHEN sort_desc IS NOT FALSE THEN -1 ELSE 1 END
            ),
            ARRAY[]::types.q_get_activity_logins_view_v4_item[]
        ) AS items
        FROM paged p
    )
    SELECT
        (SELECT items FROM items_agg) AS items,
        (SELECT total_count FROM counted) AS total_count;
$$;
