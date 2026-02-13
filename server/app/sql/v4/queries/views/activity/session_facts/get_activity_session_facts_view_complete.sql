-- ============================================================================
-- Query: get_activity_session_facts_view
-- Purpose: Fetch session facts from mv_activity_session_facts with pagination
-- Section: VIEWS/ACTIVITY/SESSION_FACTS
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
        WHERE proname = 'api_get_activity_session_facts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_session_facts_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_session_facts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_activity_session_facts_view_v4_item AS (
    session_id uuid,
    profile_id uuid,
    session_created_at timestamptz,
    session_updated_at timestamptz,
    active boolean,
    group_count int,
    first_group_at timestamptz,
    last_group_at timestamptz,
    run_count int,
    total_tokens bigint
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_activity_session_facts_view_v4(
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
    items types.q_get_activity_session_facts_view_v4_item[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_activity_session_facts mv
        WHERE (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
          AND (profile_ids_filter IS NULL OR mv.profile_id = ANY(profile_ids_filter))
          AND (active_filter IS NULL OR mv.active = active_filter)
          AND (date_from IS NULL OR mv.session_created_at >= date_from)
          AND (date_to IS NULL OR mv.session_created_at < date_to)
    ),
    counted AS (
        SELECT COUNT(*)::bigint AS total_count FROM filtered
    ),
    paged AS (
        SELECT mv.*
        FROM filtered mv
        ORDER BY
            CASE
                WHEN sort_by IS NULL OR sort_by = 'date' THEN EXTRACT(EPOCH FROM mv.session_created_at)
                WHEN sort_by = 'groups' THEN mv.group_count::double precision
                WHEN sort_by = 'runs' THEN mv.run_count::double precision
                WHEN sort_by = 'tokens' THEN mv.total_tokens::double precision
                ELSE EXTRACT(EPOCH FROM mv.session_created_at)
            END * CASE WHEN sort_desc IS NOT FALSE THEN -1 ELSE 1 END
        LIMIT page_limit OFFSET page_offset
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    p.session_id,
                    p.profile_id,
                    p.session_created_at,
                    p.session_updated_at,
                    p.active,
                    p.group_count,
                    p.first_group_at,
                    p.last_group_at,
                    p.run_count,
                    p.total_tokens
                )::types.q_get_activity_session_facts_view_v4_item
                ORDER BY
                    CASE
                        WHEN sort_by IS NULL OR sort_by = 'date' THEN EXTRACT(EPOCH FROM p.session_created_at)
                        WHEN sort_by = 'groups' THEN p.group_count::double precision
                        WHEN sort_by = 'runs' THEN p.run_count::double precision
                        WHEN sort_by = 'tokens' THEN p.total_tokens::double precision
                        ELSE EXTRACT(EPOCH FROM p.session_created_at)
                    END * CASE WHEN sort_desc IS NOT FALSE THEN -1 ELSE 1 END
            ),
            ARRAY[]::types.q_get_activity_session_facts_view_v4_item[]
        ) AS items
        FROM paged p
    )
    SELECT
        (SELECT items FROM items_agg) AS items,
        (SELECT total_count FROM counted) AS total_count;
$$;
