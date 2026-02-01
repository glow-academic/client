-- View: view_contents_entry
-- Wrapper for contents_entry with computed idx for backward compatibility.
-- After migration 364: idx column was removed from contents_entry.
-- This view computes idx using ROW_NUMBER() ordered by created_at.
-- Uses DROP/CREATE for clean replacement.

DROP VIEW IF EXISTS view_contents_entry CASCADE;

CREATE VIEW view_contents_entry AS
SELECT
    ce.id,
    ce.message_id,
    ce.content,
    (ROW_NUMBER() OVER (PARTITION BY ce.message_id ORDER BY ce.created_at) - 1)::int AS idx,
    ce.created_at,
    ce.updated_at,
    ce.generated,
    ce.mcp,
    ce.active,
    ce.call_id
FROM contents_entry ce;
