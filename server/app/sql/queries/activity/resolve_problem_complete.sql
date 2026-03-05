-- Resolve Problem
-- Inserts into resolves_entry (append-only)
-- Permission check via profiles_problems_connection

DROP FUNCTION IF EXISTS api_resolve_problem_v4(uuid, boolean, uuid);

CREATE FUNCTION api_resolve_problem_v4(
    p_problem_id uuid,
    p_resolved boolean,
    p_profile_id uuid
)
RETURNS TABLE (
    problem_id uuid,
    resolved boolean,
    updated_at timestamptz,
    actor_name text
)
LANGUAGE sql
AS $$
WITH actor_profile AS (
    SELECT nr.name
    FROM profile_names_junction pnj
    JOIN names_resource nr ON nr.id = pnj.names_id AND nr.active = true
    WHERE pnj.profile_id = p_profile_id AND pnj.active = true
    LIMIT 1
),
inserted AS (
    INSERT INTO resolves_entry (problem_id, resolved)
    SELECT p_problem_id, p_resolved
    WHERE EXISTS (
        SELECT 1 FROM profiles_problems_connection ppj
        WHERE ppj.problem_id = p_problem_id
          AND ppj.profile_id = p_profile_id
    )
    RETURNING resolves_entry.problem_id, resolves_entry.resolved, resolves_entry.created_at
)
SELECT
    i.problem_id,
    i.resolved,
    i.created_at AS updated_at,
    ap.name AS actor_name
FROM inserted i
LEFT JOIN actor_profile ap ON true;
$$;
