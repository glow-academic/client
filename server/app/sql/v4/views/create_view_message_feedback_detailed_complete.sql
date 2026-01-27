-- View: view_message_feedback_detailed_complete
-- Layer 2 Context View: Messages with aggregated feedback details.
-- Combines strengths and improvements with their highlights and replacements.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_message_feedback_detailed_complete AS
WITH
-- Get all strengths with their highlights
strengths_with_highlights AS (
    SELECT
        se.id AS strength_id,
        se.message_id,
        se.grade_id,
        se.name AS strength_name,
        se.description AS strength_description,
        se.created_at AS strength_created_at,
        -- Aggregate highlights for this strength
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'idx', h.idx,
                    'section', h.section
                )
                ORDER BY h.idx
            )
            FROM highlights_entry h
            WHERE h.message_feedback_id = se.id AND h.active = true),
            '[]'::jsonb
        ) AS highlights
    FROM strengths_entry se
    WHERE se.active = true
),
-- Get all improvements with their replacements
improvements_with_replacements AS (
    SELECT
        ie.id AS improvement_id,
        ie.message_id,
        ie.grade_id,
        ie.name AS improvement_name,
        ie.description AS improvement_description,
        ie.created_at AS improvement_created_at,
        -- Aggregate replacements for this improvement
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'idx', r.idx,
                    'section', r.section,
                    'replace', r.replace
                )
                ORDER BY r.idx
            )
            FROM replacements_entry r
            WHERE r.message_feedback_id = ie.id AND r.active = true),
            '[]'::jsonb
        ) AS replacements
    FROM improvements_entry ie
    WHERE ie.active = true
),
-- Aggregate strengths by message
strengths_aggregated AS (
    SELECT
        swh.message_id,
        swh.grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', swh.strength_id,
                    'name', swh.strength_name,
                    'description', swh.strength_description,
                    'highlights', swh.highlights
                )
                ORDER BY swh.strength_created_at
            ),
            '[]'::jsonb
        ) AS strengths
    FROM strengths_with_highlights swh
    GROUP BY swh.message_id, swh.grade_id
),
-- Aggregate improvements by message
improvements_aggregated AS (
    SELECT
        iwr.message_id,
        iwr.grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', iwr.improvement_id,
                    'name', iwr.improvement_name,
                    'description', iwr.improvement_description,
                    'replacements', iwr.replacements
                )
                ORDER BY iwr.improvement_created_at
            ),
            '[]'::jsonb
        ) AS improvements
    FROM improvements_with_replacements iwr
    GROUP BY iwr.message_id, iwr.grade_id
),
-- Get all messages that have feedback
messages_with_feedback AS (
    SELECT DISTINCT message_id, grade_id
    FROM (
        SELECT message_id, grade_id FROM strengths_entry WHERE active = true AND message_id IS NOT NULL
        UNION
        SELECT message_id, grade_id FROM improvements_entry WHERE active = true AND message_id IS NOT NULL
    ) combined
)
SELECT
    m.id AS message_id,
    m.chat_id,
    m.run_id,
    m.role,
    m.content,
    m.created_at AS message_created_at,
    m.updated_at AS message_updated_at,
    m.completed,
    m.audio,
    -- Grade this feedback belongs to
    mwf.grade_id,
    -- Aggregated feedbacks
    COALESCE(sa.strengths, '[]'::jsonb) AS strengths,
    COALESCE(ia.improvements, '[]'::jsonb) AS improvements,
    -- Combined feedbacks array (for compatibility with existing response format)
    COALESCE(
        CASE
            WHEN sa.strengths IS NOT NULL OR ia.improvements IS NOT NULL THEN
                (
                    SELECT jsonb_agg(fb ORDER BY fb->>'created_at')
                    FROM (
                        SELECT jsonb_build_object(
                            'id', s->>'id',
                            'name', s->>'name',
                            'description', s->>'description',
                            'type', 'strength',
                            'highlights', s->'highlights',
                            'replaces', '[]'::jsonb
                        ) AS fb
                        FROM jsonb_array_elements(COALESCE(sa.strengths, '[]'::jsonb)) s
                        UNION ALL
                        SELECT jsonb_build_object(
                            'id', i->>'id',
                            'name', i->>'name',
                            'description', i->>'description',
                            'type', 'improvement',
                            'highlights', '[]'::jsonb,
                            'replaces', i->'replacements'
                        ) AS fb
                        FROM jsonb_array_elements(COALESCE(ia.improvements, '[]'::jsonb)) i
                    ) combined
                )
            ELSE '[]'::jsonb
        END,
        '[]'::jsonb
    ) AS feedbacks
FROM messages_entry m
JOIN messages_with_feedback mwf ON mwf.message_id = m.id
LEFT JOIN strengths_aggregated sa ON sa.message_id = m.id AND sa.grade_id = mwf.grade_id
LEFT JOIN improvements_aggregated ia ON ia.message_id = m.id AND ia.grade_id = mwf.grade_id
WHERE m.active = true;
