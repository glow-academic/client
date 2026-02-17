-- Materialized View: mv_profile_facts
-- Profile section fact table for dashboard analytics.
--
-- Grain: One row per chat
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Supports header metrics, leaderboard, and report sections.
--   Consumers fetch filtered chat-grain rows and aggregate in Python.
--
-- Unique value vs other facts MVs: joins to attempt_message_entry + messages_entry
--   to provide num_messages_total and avg_response_sec per chat.
--
-- Section: ANALYTICS (header/leaderboard/report)
--
-- Dependencies: Uses entry/connection tables only (self-contained, no MV dependencies)

-- ============================================================================
-- Step 1: Drop all indexes on mv_profile_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_profile_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_profile_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_profile_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_profile_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_profile_facts AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points
    FROM attempt_grade_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
chat_scope AS (
    SELECT
        c.id AS chat_id,
        (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at)
            FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id
    FROM attempt_chat_entry c
    LEFT JOIN training_department_entry tbd
        ON tbd.id = c.training_department_id AND tbd.active = TRUE
    LEFT JOIN training_department_scenarios_connection tsc
        ON tsc.training_department_id = tbd.id AND tsc.active = TRUE
    WHERE c.active = TRUE
    GROUP BY c.id
),
message_stats AS (
    SELECT
        sm.chat_id,
        COUNT(*)::int AS num_messages_total,
        ROUND(
            AVG(
                EXTRACT(EPOCH FROM (sm.updated_at - sm.created_at))
            ) FILTER (WHERE m.role = 'assistant'::message_type),
            2
        ) AS avg_response_sec
    FROM attempt_message_entry sm
    JOIN messages_entry m ON m.id = sm.id
    WHERE m.active = TRUE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
    GROUP BY sm.chat_id
)
SELECT
    -- Primary key
    c.id AS chat_id,

    -- Resource IDs
    c.attempt_id,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,
    asc_conn.simulations_id AS simulation_id,
    cs.scenario_id,

    -- Timestamps
    (a.created_at AT TIME ZONE 'UTC')::date AS attempt_date,

    -- Measures
    CASE
        WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
        THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
        ELSE NULL
    END AS grade_percent,
    lg.passed,
    (EXISTS (SELECT 1 FROM attempt_completion_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,
    lg.time_taken AS time_taken_seconds,

    -- Message metrics (unique to this MV)
    COALESCE(ms.num_messages_total, 0) AS num_messages_total,
    ms.avg_response_sec,

    -- Filters
    CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(sa_archive.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode

FROM attempt_chat_entry c
JOIN attempt_entry a ON a.id = c.attempt_id
JOIN attempt_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN attempt_profiles_connection apc ON apc.attempt_id = a.id
LEFT JOIN attempt_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN attempt_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN chat_scope cs ON cs.chat_id = c.id
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN message_stats ms ON ms.chat_id = c.id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE c.active = TRUE
  AND a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_profile_facts_pk
    ON mv_profile_facts (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Resource ID indexes
CREATE INDEX mv_profile_facts_profile_id_idx
    ON mv_profile_facts (profile_id);

CREATE INDEX mv_profile_facts_cohort_id_idx
    ON mv_profile_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_profile_facts_department_id_idx
    ON mv_profile_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_profile_facts_simulation_id_idx
    ON mv_profile_facts (simulation_id);

CREATE INDEX mv_profile_facts_attempt_id_idx
    ON mv_profile_facts (attempt_id);

-- Time index
CREATE INDEX mv_profile_facts_attempt_date_idx
    ON mv_profile_facts (attempt_date DESC);

-- Flag indexes
CREATE INDEX mv_profile_facts_attempt_type_idx
    ON mv_profile_facts (attempt_type);

CREATE INDEX mv_profile_facts_is_archived_idx
    ON mv_profile_facts (is_archived);

-- Composite indexes for common query patterns

-- Profile aggregation: profile + date (for GROUP BY profile_id with date filtering)
CREATE INDEX mv_profile_facts_profile_date_idx
    ON mv_profile_facts (profile_id, attempt_date DESC);

-- Leaderboard: profile + type + archived (common filter combo for rankings)
CREATE INDEX mv_profile_facts_profile_type_archived_idx
    ON mv_profile_facts (profile_id, attempt_type, is_archived, attempt_date DESC);

-- Default filter: non-archived general
CREATE INDEX mv_profile_facts_default_idx
    ON mv_profile_facts (profile_id, attempt_date DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

-- Grade-based queries (for avg_score, highest_score rankings)
CREATE INDEX mv_profile_facts_grade_idx
    ON mv_profile_facts (grade_percent DESC NULLS LAST)
    WHERE grade_percent IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_profile_facts;
