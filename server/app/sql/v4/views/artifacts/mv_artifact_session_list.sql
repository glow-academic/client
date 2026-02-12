-- Materialized View: mv_artifact_session_list
-- Session-level aggregation for ARTIFACTS section - session list page.
--
-- Grain: One row per session
-- Purpose: Fast pagination for session list with pre-aggregated costs and audit counts
--
-- Section: ARTIFACTS (self-contained, no MV dependencies)
-- Source: sessions_entry + runs_entry + run_pricing_entry + audits_entry + profile naming
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_artifact_session_list materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_artifact_session_list'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_artifact_session_list materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_artifact_session_list CASCADE;

-- ============================================================================
-- Step 3: Create mv_artifact_session_list Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_artifact_session_list AS
WITH
run_pricing_rollup AS (
    SELECT
        rpe.run_id,
        COALESCE(SUM(
            (rpe.count::numeric / aur.value::numeric) * pr.price
        ) FILTER (WHERE rpe.pricing_type = 'input'), 0)::numeric AS input_cost,
        COALESCE(SUM(
            (rpe.count::numeric / aur.value::numeric) * pr.price
        ) FILTER (WHERE rpe.pricing_type = 'output'), 0)::numeric AS output_cost,
        COALESCE(SUM(
            (rpe.count::numeric / aur.value::numeric) * pr.price
        ) FILTER (WHERE rpe.pricing_type = 'cached'), 0)::numeric AS cached_cost
    FROM run_pricing_entry rpe
    JOIN run_pricing_pricing_connection rppc ON rppc.run_pricing_id = rpe.id AND rppc.active = TRUE
    JOIN pricing_resource pr ON pr.id = rppc.pricing_id AND pr.active = TRUE
    JOIN artifact_units_relation aur ON aur.id = rpe.unit_id AND aur.active = TRUE
    WHERE rpe.active = TRUE
    GROUP BY rpe.run_id
),
-- Aggregate run/cost data per session directly from runs_entry + groups_entry
session_pricing AS (
    SELECT
        gi.session_id,
        COUNT(DISTINCT r.group_id)::int AS group_count,
        COUNT(*)::int AS run_count,
        MIN(r.created_at) AS first_run_at,
        MAX(r.created_at) AS last_run_at,
        SUM(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0) + COALESCE(r.cached_input_tokens, 0))::bigint AS total_tokens,
        SUM(ROUND((COALESCE(rpr.input_cost, 0) + COALESCE(rpr.output_cost, 0) + COALESCE(rpr.cached_cost, 0)), 8))::numeric AS total_cost
    FROM runs_entry r
    JOIN groups_entry gi ON gi.id = r.group_id AND gi.active = TRUE
    LEFT JOIN run_pricing_rollup rpr ON rpr.run_id = r.id
    WHERE gi.session_id IS NOT NULL
    GROUP BY gi.session_id
),
-- Aggregate audit data per session
session_audits AS (
    SELECT
        a.session_id,
        COUNT(*)::int AS audit_count,
        MAX(a.created_at) AS last_audit_at,
        COUNT(*) FILTER (WHERE a.error = TRUE)::int AS error_count
    FROM audits_entry a
    WHERE a.session_id IS NOT NULL
    GROUP BY a.session_id
),
-- Profile names via junction
profile_names AS (
    SELECT
        pn.profile_id,
        n.name AS profile_name
    FROM profile_names_junction pn
    JOIN names_resource n ON pn.name_id = n.id
)
SELECT
    -- Primary key
    s.id AS session_id,

    -- Profile info
    s.profile_id,
    pnames.profile_name,

    -- Timestamps
    s.created_at AS session_created_at,
    GREATEST(
        s.created_at,
        sp.last_run_at,
        sa.last_audit_at
    ) AS session_updated_at,

    -- Status
    COALESCE(s.active, FALSE) AS active,

    -- Group/Run aggregates (from mv_pricing_group_summary)
    COALESCE(sp.group_count, 0) AS group_count,
    COALESCE(sp.run_count, 0) AS run_count,
    sp.first_run_at,
    sp.last_run_at,

    -- Token/Cost aggregates
    COALESCE(sp.total_tokens, 0)::bigint AS total_tokens,
    COALESCE(sp.total_cost, 0)::numeric AS total_cost,

    -- Audit aggregates
    COALESCE(sa.audit_count, 0) AS audit_count,
    sa.last_audit_at,
    COALESCE(sa.error_count, 0) AS error_count

FROM sessions_entry s
LEFT JOIN session_pricing sp ON sp.session_id = s.id
LEFT JOIN session_audits sa ON sa.session_id = s.id
LEFT JOIN profile_names pnames ON pnames.profile_id = s.profile_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_artifact_session_list_pk
    ON mv_artifact_session_list (session_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile filtering
CREATE INDEX mv_artifact_session_list_profile_id_idx
    ON mv_artifact_session_list (profile_id)
    WHERE profile_id IS NOT NULL;

-- Timestamp indexes
CREATE INDEX mv_artifact_session_list_created_at_idx
    ON mv_artifact_session_list (session_created_at);

CREATE INDEX mv_artifact_session_list_created_at_desc_idx
    ON mv_artifact_session_list (session_created_at DESC);

-- Active status filtering
CREATE INDEX mv_artifact_session_list_active_idx
    ON mv_artifact_session_list (active);

-- Cost indexes for sorting/filtering
CREATE INDEX mv_artifact_session_list_total_cost_idx
    ON mv_artifact_session_list (total_cost DESC)
    WHERE total_cost > 0;

CREATE INDEX mv_artifact_session_list_total_tokens_idx
    ON mv_artifact_session_list (total_tokens DESC);

-- Count-based sorting
CREATE INDEX mv_artifact_session_list_group_count_idx
    ON mv_artifact_session_list (group_count DESC);

CREATE INDEX mv_artifact_session_list_run_count_idx
    ON mv_artifact_session_list (run_count DESC);

-- Composite indexes for common query patterns
CREATE INDEX mv_artifact_session_list_profile_created_idx
    ON mv_artifact_session_list (profile_id, session_created_at DESC)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_artifact_session_list_active_created_idx
    ON mv_artifact_session_list (session_created_at DESC)
    WHERE active = TRUE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_artifact_session_list;
