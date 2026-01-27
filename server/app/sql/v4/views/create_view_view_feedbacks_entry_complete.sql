-- View: view_feedbacks_entry
-- Wrapper for feedbacks_entry. Read via view to avoid direct _entry access.
-- Regular VIEW (upgrade to MATERIALIZED VIEW later if needed).

CREATE OR REPLACE VIEW view_feedbacks_entry AS
SELECT
    *
FROM feedbacks_entry;
