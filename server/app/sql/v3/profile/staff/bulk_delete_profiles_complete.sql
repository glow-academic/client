-- Bulk delete staff profiles with validation in single query (DHH style)
-- Parameters: $1=profile_ids (uuid[])
-- Returns: deleted_count (int)

WITH deletable_profiles AS (
    -- Get list of profiles that can be deleted
    SELECT array_agg(id) as deletable_ids
    FROM profiles
    WHERE id = ANY($1::uuid[])
),
profile_delete AS (
    -- Delete profiles
    DELETE FROM profiles
    WHERE id = ANY($1::uuid[])
        AND EXISTS (SELECT 1 FROM deletable_profiles WHERE deletable_ids IS NOT NULL)
    RETURNING id
)
-- Return deletion count
SELECT 
    COALESCE((SELECT COUNT(*) FROM profile_delete), 0)::int as deleted_count
FROM deletable_profiles dp

