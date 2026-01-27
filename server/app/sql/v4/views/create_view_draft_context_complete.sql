-- View: view_draft_context_complete
-- Active draft lookup with group context.
-- Joins drafts_entry with groups_entry to provide full draft context.
-- Filters active = true to only return active drafts.
-- Write to drafts_entry, read from this _view.

CREATE OR REPLACE VIEW view_draft_context_complete AS
SELECT
    d.id AS draft_id,
    d.created_at AS draft_created_at,
    d.updated_at AS draft_updated_at,
    d.version,
    d.artifact,
    d.generated AS draft_generated,
    d.mcp AS draft_mcp,
    d.active,
    -- Group context
    d.group_id,
    g.trace_id,
    g.name AS group_name,
    g.created_at AS group_created_at,
    g.session_id
FROM drafts_entry d
LEFT JOIN groups_entry g ON g.id = d.group_id
WHERE d.active = true;
