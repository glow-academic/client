-- View: view_call_context_complete
-- Layer 2 Context View: Call with run and tool context.
-- Joins calls_entry with runs_entry, tool_calls_junction, tool_artifact.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_call_context_complete AS
SELECT
    c.id AS call_id,
    c.created_at AS call_created_at,
    c.updated_at AS call_updated_at,
    c.external_call_id,
    c.completed,
    c.template_id,
    c.arguments_raw,
    -- Run context
    c.run_id,
    r.created_at AS run_created_at,
    r.input_tokens,
    r.output_tokens,
    r.cached_input_tokens,
    -- Group context (via run)
    r.group_id,
    -- Tool context (via junction)
    tcj.tool_id,
    (SELECT n.name
     FROM tool_names_junction tn
     JOIN names_resource n ON tn.name_id = n.id
     WHERE tn.tool_id = tcj.tool_id
     LIMIT 1) AS tool_name
FROM calls_entry c
-- Run context
LEFT JOIN runs_entry r ON r.id = c.run_id
-- Tool context
LEFT JOIN tool_calls_junction tcj ON tcj.call_id = c.id;
