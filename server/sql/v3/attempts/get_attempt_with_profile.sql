-- Get attempt with active profile in single query
-- Parameters: $1=attempt_id (uuid)
-- Returns: all attempt fields plus profile_id
SELECT 
    sa.*,
    (SELECT profile_id FROM attempt_profiles WHERE attempt_id = sa.id AND active = true LIMIT 1) as profile_id
FROM simulation_attempts sa
WHERE sa.id = $1::uuid

