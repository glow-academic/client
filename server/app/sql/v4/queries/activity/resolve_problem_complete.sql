-- Resolve Problem
-- Updates problems_entry resolved status
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
    JOIN names_resource nr ON nr.id = pnj.name_id AND nr.active = true
    WHERE pnj.profile_id = p_profile_id AND pnj.active = true
    LIMIT 1
),
updated AS (
    UPDATE problems_entry pe
    SET resolved = p_resolved,
        updated_at = now()
    WHERE pe.id = p_problem_id
      AND EXISTS (
          SELECT 1 FROM profiles_problems_connection ppj
          WHERE ppj.problem_id = p_problem_id
            AND ppj.profiles_id = p_profile_id
      )
    RETURNING pe.id, pe.resolved, pe.updated_at
)
SELECT
    u.id AS problem_id,
    u.resolved,
    u.updated_at,
    ap.name AS actor_name
FROM updated u
LEFT JOIN actor_profile ap ON true;
$$;
