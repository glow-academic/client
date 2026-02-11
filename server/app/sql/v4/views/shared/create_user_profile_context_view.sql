-- View: view_user_profile_context
-- Provides role and actor_name for any profile_id.
-- Used by nearly all query functions via a thin CTE wrapper.
-- This is a regular view (not materialized) so data is always fresh.

CREATE OR REPLACE VIEW view_user_profile_context AS
SELECT
    p.id AS profile_id,
    (SELECT r.role FROM profile_roles_junction pr_j
     JOIN roles_resource r ON pr_j.role_id = r.id
     WHERE pr_j.profile_id = p.id LIMIT 1) AS role,
    COALESCE(
        (SELECT n.name FROM profile_names_junction pn
         JOIN names_resource n ON pn.name_id = n.id
         WHERE pn.profile_id = p.id LIMIT 1),
        ''
    ) AS actor_name
FROM profile_artifact p;
