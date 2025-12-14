-- Get default staff detail for creation
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
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
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', COALESCE(d.title, ''),
                    'description', COALESCE(d.description, '')
                )
            ) FILTER (WHERE d.id IS NOT NULL),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(d.id::text ORDER BY d.title) FILTER (WHERE d.id IS NOT NULL) as dept_ids
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohorts c
    WHERE c.active = true
),
cohort_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            c.id::text,
            jsonb_build_object(
                'name', COALESCE(c.title, ''),
                'description', COALESCE(c.description, '')
            )
        ) FILTER (WHERE c.id IS NOT NULL),
        '{}'::jsonb
    ) as cohort_mapping,
    array_agg(c.id::text ORDER BY c.title) FILTER (WHERE c.id IS NOT NULL) as valid_cohort_ids
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
)
SELECT 
    vd.dept_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    pdi.department_id as primary_department_id,
    COALESCE(cmd.cohort_mapping, '{}'::jsonb) as cohort_mapping,
    COALESCE(cmd.valid_cohort_ids, ARRAY[]::text[]) as valid_cohort_ids
FROM valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN cohort_mapping_data cmd
LEFT JOIN primary_department_id pdi ON true

