-- Materialized View: messages_mv
-- Lean message-level data for group detail pages.
--
-- Grain: One row per message (with run_id)
-- Filter: active = TRUE AND run_id IS NOT NULL
--
-- Purpose: Pre-aggregates contents and call_ids from attempt_content_entry
-- Section: MESSAGE (lean MV - used by group detail artifact)
--
-- Dependencies: messages_entry, attempt_content_entry
-- ============================================================================
-- Step 1: Drop all indexes on messages_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'messages_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop messages_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS messages_mv CASCADE;

-- ============================================================================
-- Step 3: Create messages_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW messages_mv AS
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
    FROM attempt_content_entry sce
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

CREATE UNIQUE INDEX messages_mv_pk
    ON messages_mv (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Run ID for filtering
CREATE INDEX messages_mv_run_id_idx
    ON messages_mv (run_id);

-- Composite: run + role sort + created_at (common query pattern)
CREATE INDEX messages_mv_run_role_created_idx
    ON messages_mv (run_id, role, message_created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW messages_mv;
