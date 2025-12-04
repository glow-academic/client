-- Update a key with department links
-- Parameters: $1=key_id, $2=name, $3=key (encrypted), $4=description, $5=active, $6=department_ids (text array, nullable), $7=profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $7::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $7::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $7::text IS NULL OR $7::text = '' THEN NULL::uuid
            ELSE $7::uuid
        END as resolved_profile_id
),
update_key AS (
    UPDATE keys
    SET 
        name = $2,
        key = $3,
        description = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as key_id, key
),
replace_departments AS (
    -- Deactivate all existing department links
    UPDATE key_departments 
    SET active = false, updated_at = NOW()
    WHERE key_id = $1::uuid AND active = true
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO key_departments (key_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
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
FROM update_key
