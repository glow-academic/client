-- ============================================================================
-- Query: get_activity_feedbacks_view
-- Purpose: Fetch feedback data from mv_activity_feedbacks with pagination
-- Section: VIEWS/ACTIVITY/FEEDBACKS
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
        WHERE proname = 'api_get_activity_feedbacks_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_activity_feedbacks_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_activity_feedbacks_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_activity_feedbacks_view_v4_item AS (
    feedback_id uuid,
    grade_id uuid,
    feedback_type text,
    total int,
    total_points numeric,
    pass_points numeric,
    created_at timestamptz,
    updated_at timestamptz,
    call_id uuid,
    active boolean,
    simulation_attempt_id uuid,
    benchmark_test_id uuid,
    profile_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_activity_feedbacks_view_v4(
    profile_id_filter uuid DEFAULT NULL,
    profile_ids_filter uuid[] DEFAULT NULL,
    feedback_type_filter text DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    sort_desc boolean DEFAULT TRUE,
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_activity_feedbacks_view_v4_item[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM mv_activity_feedbacks mv
        WHERE (profile_id_filter IS NULL OR mv.profile_id = profile_id_filter)
          AND (profile_ids_filter IS NULL OR mv.profile_id = ANY(profile_ids_filter))
          AND (feedback_type_filter IS NULL OR mv.feedback_type = feedback_type_filter)
          AND (date_from IS NULL OR mv.created_at >= date_from)
          AND (date_to IS NULL OR mv.created_at < date_to)
    ),
    counted AS (
        SELECT COUNT(*)::bigint AS total_count FROM filtered
    ),
    paged AS (
        SELECT mv.*
        FROM filtered mv
        ORDER BY EXTRACT(EPOCH FROM mv.created_at) * CASE WHEN sort_desc IS NOT FALSE THEN -1 ELSE 1 END
        LIMIT page_limit OFFSET page_offset
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    p.feedback_id,
                    p.grade_id,
                    p.feedback_type,
                    p.total,
                    p.total_points,
                    p.pass_points,
                    p.created_at,
                    p.updated_at,
                    p.call_id,
                    p.active,
                    p.simulation_attempt_id,
                    p.benchmark_test_id,
                    p.profile_id
                )::types.q_get_activity_feedbacks_view_v4_item
                ORDER BY EXTRACT(EPOCH FROM p.created_at) * CASE WHEN sort_desc IS NOT FALSE THEN -1 ELSE 1 END
            ),
            ARRAY[]::types.q_get_activity_feedbacks_view_v4_item[]
        ) AS items
        FROM paged p
    )
    SELECT
        (SELECT items FROM items_agg) AS items,
        (SELECT total_count FROM counted) AS total_count;
$$;
