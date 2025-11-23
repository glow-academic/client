-- Delete persona with usage check and name fetch - returns usage_count, name, and deleted (boolean)
-- Parameters: $1 = persona_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: usage_count (int), name (text), deleted (boolean)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
usage_check AS (
    SELECT COUNT(*)::integer as usage_count
    FROM scenario_personas
    WHERE persona_id = $1 AND active = true
),
persona_info AS (
    SELECT name FROM personas WHERE id = $1
),
delete_result AS (
    DELETE FROM personas 
    WHERE id = $1 
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM persona_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM persona_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted

