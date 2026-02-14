-- Materialized View: mv_messages
-- Lean message-level data for group detail pages.
--
-- Grain: One row per message (with run_id)
-- Filter: active = TRUE AND run_id IS NOT NULL
--
-- Purpose: Pre-aggregates contents and call_ids from simulation_contents_entry
-- Section: MESSAGE (lean MV - used by group detail artifact)
--
-- Dependencies: messages_entry, simulation_contents_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_messages materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_messages materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_messages CASCADE;

-- ============================================================================
-- Step 3: Create mv_messages Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_messages AS
WITH
contents_agg AS (
    SELECT
        sce.message_id,
        COALESCE(
            ARRAY_AGG(sce.content ORDER BY sce.created_at) FILTER (WHERE sce.id IS NOT NULL),
            ARRAY[]::text[]
        ) AS contents,
        COALESCE(
            ARRAY_AGG(DISTINCT sce.call_id) FILTER (WHERE sce.call_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS call_ids
    FROM simulation_contents_entry sce
    WHERE sce.active = TRUE
    GROUP BY sce.message_id
)
SELECT
    m.id AS message_id,
    m.run_id,
    m.role::text AS role,
    m.created_at AS message_created_at,
    COALESCE(ca.contents, ARRAY[]::text[]) AS contents,
    COALESCE(ca.call_ids, ARRAY[]::uuid[]) AS call_ids
FROM messages_entry m
LEFT JOIN contents_agg ca ON ca.message_id = m.id
WHERE m.active = TRUE AND m.run_id IS NOT NULL
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_messages_pk
    ON mv_messages (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Run ID for filtering
CREATE INDEX mv_messages_run_id_idx
    ON mv_messages (run_id);

-- Composite: run + role sort + created_at (common query pattern)
CREATE INDEX mv_messages_run_role_created_idx
    ON mv_messages (run_id, role, message_created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_messages;
