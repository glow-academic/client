-- View: view_messages_complete
-- Combines messages_entry + simulation_contents_entry + hints_entry + audios_entry
-- Write to _entry tables, read from this _view.
-- Uses ARRAY_AGG for all content chunks. Filters active = true.
--
-- Note: After migration 364, messages_entry is the base table.
-- Contents are ordered by created_at (idx column was removed).

CREATE OR REPLACE VIEW view_messages_complete AS
SELECT
    m.id,
    m.run_id,
    m.role,
    m.created_at,
    m.updated_at,
    m.completed,
    m.audio,
    m.generated,
    m.mcp,
    m.active,
    -- All content chunks as array (ordered by created_at)
    COALESCE(
        (SELECT ARRAY_AGG(
            jsonb_build_object(
                'id', c.id,
                'content', c.content,
                'created_at', c.created_at,
                'call_id', c.call_id
            ) ORDER BY c.created_at
        )
        FROM simulation_contents_entry c
        WHERE c.message_id = m.id AND c.active = true),
        '{}'::jsonb[]
    ) AS contents,
    -- All hints as array (ordered by created_at)
    COALESCE(
        (SELECT ARRAY_AGG(
            jsonb_build_object(
                'id', h.id,
                'hint', h.hint,
                'idx', h.idx,
                'call_id', h.call_id
            ) ORDER BY h.idx
        )
        FROM (
            SELECT
                h.id,
                h.message_id,
                h.hint,
                h.call_id,
                h.created_at,
                (ROW_NUMBER() OVER (PARTITION BY h.message_id ORDER BY h.created_at) - 1) AS idx
            FROM simulation_hints_entry h
            WHERE h.active = true
        ) h
        WHERE h.message_id = m.id),
        '{}'::jsonb[]
    ) AS hints,
    -- Audio if present
    (SELECT a.id FROM audios_entry a
     WHERE a.message_id = m.id AND a.active = true
     LIMIT 1) AS audio_id
FROM messages_entry m
WHERE m.active = true;
