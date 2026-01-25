-- View: view_message_feedback_complete
-- Aggregates highlights_entry and replacements_entry by message_feedback_id.
-- Write to _entry tables, read from this _view.
-- Uses ARRAY_AGG for highlights and replacements. Filters active = true.
-- Note: message_feedback_id comes from strengths_entry or improvements_entry

CREATE OR REPLACE VIEW view_message_feedback_complete AS
SELECT
    message_feedback_id,
    -- All highlights as array (ordered by idx)
    COALESCE(
        ARRAY_AGG(
            DISTINCT jsonb_build_object(
                'idx', h.idx,
                'section', h.section
            )
        ) FILTER (WHERE h.idx IS NOT NULL),
        '{}'::jsonb[]
    ) AS highlights,
    -- All replacements as array (ordered by idx)
    COALESCE(
        (SELECT ARRAY_AGG(
            jsonb_build_object(
                'idx', r.idx,
                'section', r.section,
                'replace', r.replace
            ) ORDER BY r.idx
        )
        FROM replacements_entry r
        WHERE r.message_feedback_id = h.message_feedback_id AND r.active = true),
        '{}'::jsonb[]
    ) AS replacements
FROM highlights_entry h
WHERE h.active = true AND h.message_feedback_id IS NOT NULL
GROUP BY h.message_feedback_id;
