-- View: view_grade_feedback_complete
-- Combines feedbacks_entry + strengths_entry + improvements_entry
-- Write to _entry tables, read from this _view.
-- Uses ARRAY_AGG for strengths and improvements. Filters active = true.

CREATE OR REPLACE VIEW view_grade_feedback_complete AS
SELECT
    f.id,
    f.grade_id,
    f.total,
    f.feedback,
    f.created_at,
    f.updated_at,
    f.generated,
    f.mcp,
    f.active,
    f.call_id,
    -- All strengths as array
    COALESCE(
        (SELECT ARRAY_AGG(
            jsonb_build_object(
                'id', s.id,
                'message_id', s.message_id,
                'name', s.name,
                'description', s.description,
                'call_id', s.call_id
            )
        )
        FROM strengths_entry s
        WHERE s.grade_id = f.grade_id AND s.active = true),
        '{}'::jsonb[]
    ) AS strengths,
    -- All improvements as array
    COALESCE(
        (SELECT ARRAY_AGG(
            jsonb_build_object(
                'id', i.id,
                'message_id', i.message_id,
                'name', i.name,
                'description', i.description,
                'call_id', i.call_id
            )
        )
        FROM improvements_entry i
        WHERE i.grade_id = f.grade_id AND i.active = true),
        '{}'::jsonb[]
    ) AS improvements
FROM feedbacks_entry f
WHERE f.active = true;
