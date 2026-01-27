-- View: view_run_context_complete
-- Layer 2 Context View: Run with group, session, and profile/agent context.
-- Joins runs_entry with groups_entry, sessions_entry, profile_runs_junction, agent_runs_junction.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_run_context_complete AS
SELECT
    r.id AS run_id,
    r.created_at AS run_created_at,
    r.updated_at AS run_updated_at,
    r.input_tokens,
    r.output_tokens,
    r.cached_input_tokens,
    r.generated AS run_generated,
    r.mcp AS run_mcp,
    -- Group context
    r.group_id,
    g.trace_id,
    g.name AS group_name,
    g.created_at AS group_created_at,
    -- Session context (via group)
    g.session_id,
    s.created_at AS session_created_at,
    s.active AS session_active,
    -- Profile context (via junction)
    prj.profile_id,
    -- Agent context (via junction)
    arj.agent_id
FROM runs_entry r
-- Group context
LEFT JOIN groups_entry g ON g.id = r.group_id
-- Session context (via group)
LEFT JOIN sessions_entry s ON s.id = g.session_id
-- Profile context
LEFT JOIN profile_runs_junction prj ON prj.run_id = r.id
-- Agent context
LEFT JOIN agent_runs_junction arj ON arj.run_id = r.id;
