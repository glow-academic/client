-- Create Problem
-- Inserts into problems_entry + profile_problems_junction
-- Returns problem_id and actor_name

DROP FUNCTION IF EXISTS api_create_problem_v4(feedback_type, text, uuid);

CREATE FUNCTION api_create_problem_v4(
    p_type feedback_type,
    p_message text,
    p_profile_id uuid
)
RETURNS TABLE (
    problem_id uuid,
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
new_problem AS (
    INSERT INTO problems_entry (type, message)
    VALUES (p_type, p_message)
    RETURNING id
),
junction AS (
    INSERT INTO profile_problems_junction (profile_id, problem_id)
    SELECT p_profile_id, np.id
    FROM new_problem np
)
SELECT
    np.id AS problem_id,
    ap.name AS actor_name
FROM new_problem np
LEFT JOIN actor_profile ap ON true;
$$;
