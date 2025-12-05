WITH resolve_guest_profile AS (
    SELECT 
        COALESCE(
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $8::uuid AND sdg.active = true
             LIMIT 1),
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $8::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $8::text IS NULL OR $8::text = '' THEN NULL::uuid
            ELSE $8::uuid
        END as resolved_profile_id
),
update_field AS (
    UPDATE fields SET
        name = $2,
        description = $3,
        value = $4,
        default_field = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as field_id
),
delete_existing_parameters AS (
    -- Delete all existing parameter links
    DELETE FROM field_parameters 
    WHERE field_id = $1::uuid
),
link_parameters AS (
    -- Link field to parameters if provided
    INSERT INTO field_parameters (field_id, parameter_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST(COALESCE($7::text[], ARRAY[]::text[])) as param_id
    WHERE $7 IS NOT NULL AND array_length($7::text[], 1) > 0
    ON CONFLICT (field_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_existing_departments AS (
    -- Delete all existing department links
    DELETE FROM field_departments 
    WHERE field_id = $1::uuid
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST(COALESCE($6::text[], ARRAY[]::text[])) as dept_id
    WHERE $6 IS NOT NULL AND array_length($6::text[], 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT field_id FROM update_field

