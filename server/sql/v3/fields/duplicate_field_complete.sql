WITH resolve_guest_profile AS (
    SELECT 
        COALESCE(
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
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
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
original_field AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        f.value,
        f.default_field
    FROM fields f
    WHERE f.id = $1::uuid
),
original_parameters AS (
    SELECT fp.parameter_id
    FROM field_parameters fp
    WHERE fp.field_id = (SELECT id FROM original_field)
    AND fp.active = true
),
original_departments AS (
    SELECT fd.department_id
    FROM field_departments fd
    WHERE fd.field_id = (SELECT id FROM original_field)
    AND fd.active = true
),
new_field AS (
    INSERT INTO fields (
        name,
        description,
        value,
        default_field
    )
    SELECT 
        of.name || ' (Copy)',
        of.description,
        of.value,
        of.default_field
    FROM original_field of
    RETURNING id::text as field_id
),
link_parameters AS (
    -- Link new field to same parameters as original
    INSERT INTO field_parameters (field_id, parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        op.parameter_id,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN original_parameters op
    ON CONFLICT (field_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link new field to same departments as original
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        od.department_id,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN original_departments od
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT field_id FROM new_field

