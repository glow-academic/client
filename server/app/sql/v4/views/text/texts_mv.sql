-- Materialized View: texts_mv
-- Lean text-level data for text views.
--
-- Grain: One row per text entry (within a texts resource)
-- Filter: active = true only
--
-- Purpose: Text entry metadata (content, content_hash)
-- Section: TEXT (lean MV)
--
-- Dependencies: texts_resource, texts_texts_connection, texts_entry
-- ============================================================================
-- Step 1: Drop all indexes on texts_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'texts_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop texts_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS texts_mv CASCADE;

-- ============================================================================
-- Step 3: Create texts_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW texts_mv AS
SELECT
    tr.id        AS texts_id,
    te.id        AS text_id,
    te.content,
    te.content_hash,
    te.created_at
FROM texts_resource tr
JOIN texts_texts_connection ttc ON ttc.texts_id = tr.id AND ttc.active = true
JOIN texts_entry te ON te.id = ttc.text_id AND te.active = true
WHERE tr.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX texts_mv_pk
    ON texts_mv (texts_id, text_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX texts_mv_texts_id_idx
    ON texts_mv (texts_id);

CREATE INDEX texts_mv_text_id_idx
    ON texts_mv (text_id);

CREATE INDEX texts_mv_content_hash_idx
    ON texts_mv (content_hash);

CREATE INDEX texts_mv_created_at_idx
    ON texts_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW texts_mv;
