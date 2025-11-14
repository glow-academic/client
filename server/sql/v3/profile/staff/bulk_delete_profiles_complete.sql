-- Bulk delete staff profiles with validation in single query (DHH style)
-- Parameters: $1=profile_ids (uuid[])
-- Returns: deleted_count (int), default_profile_ids (uuid[])

WITH default_check AS (
    -- Check which profiles are default (cannot be deleted)
    SELECT array_agg(id) as default_ids
    FROM profiles 
    WHERE id = ANY($1::uuid[]) AND default_profile = true
),
deletable_profiles AS (
    -- Get list of profiles that can be deleted (not default)
    SELECT array_agg(id) as deletable_ids
    FROM profiles
    WHERE id = ANY($1::uuid[])
        AND default_profile = false
),
profile_delete AS (
    -- Delete non-default profiles
    DELETE FROM profiles
    WHERE id = ANY($1::uuid[])
        AND default_profile = false
        AND EXISTS (SELECT 1 FROM deletable_profiles WHERE deletable_ids IS NOT NULL)
    RETURNING id
)
-- Return deletion count and default profile IDs
SELECT 
    COALESCE((SELECT COUNT(*) FROM profile_delete), 0)::int as deleted_count,
    COALESCE(dc.default_ids, ARRAY[]::uuid[]) as default_profile_ids
FROM default_check dc

