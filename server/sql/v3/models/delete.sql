-- Delete model with usage checks (personas and agents) and name fetch - returns usage counts, name, and deleted (boolean)
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: personas_usage_count (int), agents_usage_count (int), name (text), deleted (boolean)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
personas_usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM personas
    WHERE model_id = $1
),
agents_usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM agents
    WHERE model_id = $1
),
model_info AS (
    SELECT name FROM models WHERE id = $1
),
delete_result AS (
    DELETE FROM models 
    WHERE id = $1 
      AND (SELECT usage_count FROM personas_usage_check) = 0
      AND (SELECT usage_count FROM agents_usage_check) = 0
      AND EXISTS(SELECT 1 FROM model_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM personas_usage_check) as personas_usage_count,
    (SELECT usage_count FROM agents_usage_check) as agents_usage_count,
    (SELECT name FROM model_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted

