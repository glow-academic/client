WITH resolve_guest_profile AS (
    SELECT 
        COALESCE(
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $7::uuid AND sdg.active = true
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
            WHEN $7::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $7::text IS NULL OR $7::text = '' THEN NULL::uuid
            ELSE $7::uuid
        END as resolved_profile_id
),
new_field AS (
    INSERT INTO fields (
        name,
        description,
        active
    )
    VALUES ($1, $2, COALESCE($3, true))
    RETURNING id::text as field_id
),
link_parameters AS (
    -- Link field to parameters if provided (creates parameter_fields entries)
    INSERT INTO parameter_fields (parameter_id, field_id, default, active, created_at, updated_at)
    SELECT 
        param_id::uuid,
        nf.field_id::uuid,
        false, -- default will be set when parameter is edited
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($5::text[], ARRAY[]::text[])) as param_id
    WHERE $5 IS NOT NULL AND array_length($5::text[], 1) > 0
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($6::text[], ARRAY[]::text[])) as cond_param_id
    WHERE $6 IS NOT NULL AND array_length($6::text[], 1) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($4::text[], ARRAY[]::text[])) as dept_id
    WHERE $4 IS NOT NULL AND array_length($4::text[], 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT field_id FROM new_field

