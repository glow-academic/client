-- Update department with profile relationships in single query (DHH style)
-- Parameters: $1=department_id (uuid), $2=title, $3=description, $4=active, $5=profile_ids (text[])
-- Returns: id, title

WITH department_update AS (
    -- Update department
    UPDATE departments SET
        title = $2,
        description = $3,
        active = $4,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id, title
),
deactivate_profiles AS (
    -- Deactivate existing profile relationships not in the new list
    UPDATE profile_departments
    SET active = false, updated_at = NOW()
    WHERE department_id = $1::uuid
      AND COALESCE(array_length($5::text[], 1), 0) > 0
      AND profile_id NOT IN (
          SELECT profile_id::uuid
          FROM UNNEST($5::text[]) as profile_id
      )
),
link_profiles AS (
    -- Link new profiles if provided
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active, created_at, updated_at)
    SELECT 
        profile_id::uuid,
        du.id,
        (ROW_NUMBER() OVER (ORDER BY profile_id) = 1) as is_primary,  -- First profile gets primary
        true,
        NOW(),
        NOW()
    FROM department_update du
    CROSS JOIN UNNEST($5::text[]) as profile_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
)
-- Return updated department info
SELECT id, title FROM department_update

