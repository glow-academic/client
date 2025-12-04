-- Create a new key with department links
-- Parameters: $1=name, $2=key (encrypted), $3=description, $4=active, $5=department_ids (text array, nullable), $6=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $6::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $6::text IS NULL OR $6::text = '' THEN NULL::uuid
            ELSE $6::uuid
        END as resolved_profile_id
),
new_key AS (
    INSERT INTO keys (
        name,
        key,
        description,
        active
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id::text as key_id, key
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO key_departments (key_id, department_id, active, created_at, updated_at)
    SELECT 
        nk.key_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_key nk
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (key_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    key_id,
    CASE 
        WHEN LENGTH(key) > 4 THEN LEFT(key, 4) || '****'
        ELSE '****'
    END as key_masked
FROM new_key
