-- View: view_profile_department
-- Layer 2 Domain Aggregate View: Effective department for each profile.
-- Picks the primary department if set; otherwise earliest assignment.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_profile_department AS
SELECT DISTINCT ON (p.id)
    p.id AS profile_id,
    pd.department_id
FROM profile_artifact p
LEFT JOIN profile_departments_junction pd
    ON pd.profile_id = p.id AND pd.active = true
ORDER BY p.id, pd.is_primary DESC NULLS LAST, pd.created_at ASC;
