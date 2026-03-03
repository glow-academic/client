-- Materialized View: attempt_message_tree_mv
-- Grain: One row per message (with recursive branch_path)
-- Provides tree structure for message branching
--
-- Purpose: Flat recursive tree walk for simulation message branching
-- Section: SIMULATION (lean MV)
--
-- Dependencies: attempt_message_entry, attempt_message_tree_entry
-- ============================================================================
-- Step 1: Drop all indexes on attempt_message_tree_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_message_tree_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop attempt_message_tree_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_message_tree_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_message_tree_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_message_tree_mv AS
WITH RECURSIVE walk AS (
    -- Roots: messages that never appear as child_id in the tree
    SELECT
        sm.id AS message_id,
        ARRAY[sm.id] AS branch_path,
        0 AS depth
    FROM attempt_message_entry sm
    LEFT JOIN attempt_message_tree_entry smt
        ON smt.child_id = sm.id AND smt.active = true
    WHERE smt.child_id IS NULL

    UNION ALL

    -- Children: walk down the tree
    SELECT
        smt.child_id AS message_id,
        w.branch_path || smt.child_id,
        w.depth + 1
    FROM attempt_message_tree_entry smt
    JOIN walk w ON w.message_id = smt.parent_id
    WHERE smt.active = true
)
SELECT
    message_id,
    branch_path,
    depth
FROM walk
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX attempt_message_tree_mv_pk
    ON attempt_message_tree_mv (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Depth for filtering
CREATE INDEX attempt_message_tree_mv_depth_idx
    ON attempt_message_tree_mv (depth);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_message_tree_mv;
