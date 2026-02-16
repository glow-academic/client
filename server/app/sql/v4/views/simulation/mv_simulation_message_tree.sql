-- Materialized View: mv_simulation_message_tree
-- Grain: One row per message (with recursive branch_path)
-- Provides tree structure for message branching
--
-- Purpose: Flat recursive tree walk for simulation message branching
-- Section: SIMULATION (lean MV)
--
-- Dependencies: simulation_messages_entry, simulation_message_tree_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_message_tree materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_message_tree'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_message_tree materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_message_tree CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_message_tree Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_message_tree AS
WITH RECURSIVE walk AS (
    -- Roots: messages that never appear as child_id in the tree
    SELECT
        sm.id AS message_id,
        ARRAY[sm.id] AS branch_path,
        0 AS depth
    FROM simulation_messages_entry sm
    LEFT JOIN simulation_message_tree_entry smt
        ON smt.child_id = sm.id AND smt.active = true
    WHERE smt.child_id IS NULL

    UNION ALL

    -- Children: walk down the tree
    SELECT
        smt.child_id AS message_id,
        w.branch_path || smt.child_id,
        w.depth + 1
    FROM simulation_message_tree_entry smt
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

CREATE UNIQUE INDEX mv_simulation_message_tree_pk
    ON mv_simulation_message_tree (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Depth for filtering
CREATE INDEX mv_simulation_message_tree_depth_idx
    ON mv_simulation_message_tree (depth);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_message_tree;
