-- Union View: message_tree_entry
-- Combines general_message_tree_entry and practice_message_tree_entry
-- into a single view for backward compatibility with queries that expect a unified message_tree table.
--
-- Note: The 'type' column indicates the source table ('general', 'practice').
-- Benchmark doesn't have message_tree_entry.
-- Uses OR REPLACE for idempotent execution.

CREATE OR REPLACE VIEW message_tree_entry AS
SELECT
    parent_id,
    child_id,
    created_at,
    updated_at,
    active,
    generated,
    mcp,
    'general'::text AS type
FROM general_message_tree_entry

UNION ALL

SELECT
    parent_id,
    child_id,
    created_at,
    updated_at,
    active,
    generated,
    mcp,
    'practice'::text AS type
FROM practice_message_tree_entry;
