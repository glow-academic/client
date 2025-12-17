-- Get profile context with emulation validation in a single transaction
-- Parameters: 
--   $1=actualProfileId (uuid or null), $2=effectiveProfileId (uuid or null)
--   $3=departmentId (text, optional - from cookies), $4=authMode (text, optional - "default-guest" | "default-account")
-- Returns: Complete profile context data, or NULL if emulation is unauthorized
-- Note: If actualProfileId/effectiveProfileId are null, profile is resolved from department settings using cookies
WITH resolve_profile_from_department AS (
    -- Resolve profile ID from department settings when profile IDs are null
    -- This happens when user is accessing via guest/default-account cookies
    -- department-id ($3) can be NULL for default settings (no department-specific settings)
    SELECT 
        CASE 
            -- If both profile IDs are null and we have auth_mode, resolve from settings
            WHEN $1::uuid IS NULL AND $2::uuid IS NULL 
                 AND $4::text IN ('default-guest', 'default-account') THEN
                COALESCE(
                    -- Try department-specific settings first (only if department_id is provided)
                    CASE 
                        WHEN $3::text IS NOT NULL AND $3::text != '' THEN
                            CASE 
                                WHEN $4::text = 'default-guest' THEN
                                    (SELECT sdg.profile_id
                                     FROM settings s
                                     JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                     JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                                     WHERE ds.department_id = $3::uuid AND s.active = true
                                     LIMIT 1)
                                WHEN $4::text = 'default-account' THEN
                                    (SELECT sda.profile_id
                                     FROM settings s
                                     JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                     JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                                     WHERE ds.department_id = $3::uuid AND s.active = true
                                     LIMIT 1)
                            END
                        ELSE NULL::uuid
                    END,
                    -- Fallback to default settings (no department links) - always try this
                    CASE 
                        WHEN $4::text = 'default-guest' THEN
                            (SELECT sdg.profile_id
                             FROM settings s
                             JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                             WHERE s.active = true
                               AND NOT EXISTS (
                                   SELECT 1 FROM department_settings ds 
                                   WHERE ds.settings_id = s.id AND ds.active = true
                               )
                             LIMIT 1)
                        WHEN $4::text = 'default-account' THEN
                            (SELECT sda.profile_id
                             FROM settings s
                             JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                             WHERE s.active = true
                               AND NOT EXISTS (
                                   SELECT 1 FROM department_settings ds 
                                   WHERE ds.settings_id = s.id AND ds.active = true
                               )
                             LIMIT 1)
                    END
                )
            ELSE NULL::uuid
        END as resolved_profile_id
),
resolved_profile_ids AS (
    -- Use provided profile IDs if available, otherwise use resolved profile from department
    SELECT 
        COALESCE($1::uuid, (SELECT resolved_profile_id FROM resolve_profile_from_department)) as actual_profile_id,
        COALESCE($2::uuid, (SELECT resolved_profile_id FROM resolve_profile_from_department)) as effective_profile_id
),
emulation_validation AS (
    -- Validate emulation is authorized when profiles differ
    SELECT 
        (SELECT actual_profile_id FROM resolved_profile_ids) as resolved_actual_profile_id,
        (SELECT effective_profile_id FROM resolved_profile_ids) as resolved_effective_profile_id,
        CASE 
            WHEN (SELECT actual_profile_id FROM resolved_profile_ids) = (SELECT effective_profile_id FROM resolved_profile_ids) THEN true  -- Same profile, always allowed
            ELSE (
                -- Check if effective profile is in simulatable list based on actual user's role
                SELECT EXISTS (
                    SELECT 1
                    FROM profiles p_actual
                    CROSS JOIN profiles p_effective
                    WHERE p_actual.id = (SELECT actual_profile_id FROM resolved_profile_ids)
                      AND p_effective.id = (SELECT effective_profile_id FROM resolved_profile_ids)
                      AND p_effective.id != p_actual.id
                      AND CASE 
                        WHEN p_actual.role = 'superadmin' THEN true
                        WHEN p_actual.role = 'admin' THEN p_effective.role IN ('instructional', 'member', 'guest')
                        WHEN p_actual.role = 'instructional' THEN p_effective.role IN ('member', 'guest')
                        ELSE false
                      END
                )
            )
        END as is_authorized
),
actual_profile_role AS (
    -- Use actual (logged-in) user's role for emulation permissions
    SELECT role FROM profiles p WHERE p.id = (SELECT actual_profile_id FROM resolved_profile_ids)
),
effective_profile_role AS (
    -- Use effective profile's role for UI permissions filtering
    SELECT role FROM profiles p WHERE p.id = (SELECT effective_profile_id FROM resolved_profile_ids)
),
scoped_roles_computed AS (
    -- Compute scoped roles based on effective profile's role
    SELECT 
        CASE 
            WHEN epr.role = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::profile_role[]
            WHEN epr.role = 'admin' THEN ARRAY['admin', 'instructional', 'member', 'guest']::profile_role[]
            WHEN epr.role = 'instructional' THEN ARRAY['instructional', 'member', 'guest']::profile_role[]
            WHEN epr.role = 'member' THEN ARRAY['member']::profile_role[]
            ELSE ARRAY['guest']::profile_role[]
        END as scoped_roles
    FROM effective_profile_role epr
),
actual_profile_data AS (
    -- Fetch the logged-in user's profile
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        COALESCE(prl.requests_per_day, 0) as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profiles p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id = (SELECT actual_profile_id FROM resolved_profile_ids)
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
             prl.requests_per_day, p.last_login, pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
),
effective_profile_data AS (
    -- Fetch the profile being viewed (could be same as actual or emulated)
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        COALESCE(prl.requests_per_day, 0) as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profiles p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id = (SELECT effective_profile_id FROM resolved_profile_ids)
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
             prl.requests_per_day, p.last_login, pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
),
dept_data AS (
    -- Departments for the effective profile
    SELECT 
        d.id,
        d.title,
        d.description,
        d.active,
        pd.is_primary
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT effective_profile_id FROM resolved_profile_ids)
      AND pd.active = true
),
cohort_data AS (
    -- Cohorts for the effective profile
    SELECT DISTINCT
        c.id,
        c.title,
        c.description,
        c.active,
        COALESCE(cdd.department_ids, NULL) as department_ids
    FROM cohort_profiles pc
    JOIN cohorts c ON c.id = pc.cohort_id
    LEFT JOIN (
        SELECT 
            cd.cohort_id,
            ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
        FROM cohort_departments cd
        WHERE cd.active = true
        GROUP BY cd.cohort_id
    ) cdd ON cdd.cohort_id = c.id
    WHERE pc.profile_id = (SELECT effective_profile_id FROM resolved_profile_ids)
      AND pc.active = true
      AND c.active = true
),
sim_data AS (
    -- Simulations for the effective profile's cohorts
    SELECT DISTINCT
        s.id,
        s.title,
        s.description,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        s.active,
        s.practice_simulation
    FROM simulations s
    JOIN cohort_simulations cs ON cs.simulation_id = s.id
    JOIN cohort_data cd ON cd.id = cs.cohort_id
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = s.id
    WHERE s.active = true
),
earliest_attempt AS (
    -- Earliest attempt across all departments the effective profile belongs to
    SELECT MIN(sa.created_at) as earliest
    -- Get all departments for the effective profile
    FROM profile_departments pd_effective
    -- Get all profiles in those departments
    JOIN profile_departments pd_all ON pd_all.department_id = pd_effective.department_id
        AND pd_all.active = true
    -- Get attempts for those profiles
    JOIN attempt_profiles ap ON ap.profile_id = pd_all.profile_id
        AND ap.active = true
    JOIN simulation_attempts sa ON sa.id = ap.attempt_id
    WHERE pd_effective.profile_id = (SELECT effective_profile_id FROM resolved_profile_ids)
      AND pd_effective.active = true
),
settings_resolution AS (
    -- Resolve settings based on effective profile's department
    -- Logic: department-specific → default → any active
    WITH default_settings AS (
        -- Get settings with no department links (cross-department/default)
        SELECT s.id as settings_id
        FROM settings s
        WHERE s.active = true
          AND NOT EXISTS (
              SELECT 1 FROM department_settings sd 
              WHERE sd.settings_id = s.id AND sd.active = true
          )
        LIMIT 1
    ),
    effective_profile_department AS (
        -- Get effective profile's primary department
        SELECT pd.department_id
        FROM resolved_profile_ids rpi
        JOIN profile_departments pd ON pd.profile_id = rpi.effective_profile_id
        WHERE pd.is_primary = TRUE 
          AND pd.active = true
        LIMIT 1
    ),
    dept_specific_settings AS (
        -- Get department-specific settings (if effective profile has a department)
        SELECT s.id as settings_id
        FROM settings s
        JOIN department_settings sd ON sd.settings_id = s.id
        JOIN effective_profile_department epd ON sd.department_id = epd.department_id
        WHERE s.active = true 
          AND sd.active = true
        LIMIT 1
    ),
    selected_settings AS (
        -- Priority: department-specific settings, then default, then any active
        SELECT 
            COALESCE(
                (SELECT settings_id FROM dept_specific_settings),
                (SELECT settings_id FROM default_settings),
                (SELECT id FROM settings WHERE active = true LIMIT 1)
            ) as settings_id
    ),
    settings_auths_data AS (
        -- Get linked auths for this settings
        SELECT 
            ARRAY_AGG(a.id::text ORDER BY a.name) as auth_ids,
            COALESCE(
                jsonb_object_agg(
                    a.id::text,
                    jsonb_build_object(
                        'name', a.name,
                        'description', COALESCE(a.description, ''),
                        'slug', a.slug
                    )
                ),
                '{}'::jsonb
            ) as auth_mapping
        FROM selected_settings ss
        JOIN setting_auths sa ON sa.settings_id = ss.settings_id AND sa.active = true
        JOIN auth a ON a.id = sa.auth_id AND a.active = true
    ),
    settings_providers_data AS (
        -- Get linked providers for this settings
        SELECT 
            ARRAY_AGG(p.id::text ORDER BY p.name) as provider_ids,
            COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object(
                        'name', p.name,
                        'description', COALESCE(p.description, ''),
                        'value', p.value
                    )
                ),
                '{}'::jsonb
            ) as provider_mapping
        FROM selected_settings ss
        JOIN setting_providers sp ON sp.settings_id = ss.settings_id AND sp.active = true
        JOIN providers p ON p.id = sp.provider_id AND p.active = true
    ),
    settings_default_guest_data AS (
        -- Get default guest account: try selected settings first, fall back to default settings
        SELECT 
            COALESCE(
                (SELECT sdg.profile_id::text
                 FROM selected_settings ss
                 JOIN settings_default_guest sdg ON sdg.settings_id = ss.settings_id AND sdg.active = true
                 LIMIT 1),
                (SELECT sdg.profile_id::text
                 FROM default_settings ds
                 JOIN settings_default_guest sdg ON sdg.settings_id = ds.settings_id AND sdg.active = true
                 LIMIT 1)
            ) as default_guest_profile_id
    ),
    settings_default_account_data AS (
        -- Get default account: try selected settings first, fall back to default settings
        SELECT 
            COALESCE(
                (SELECT sda.profile_id::text
                 FROM selected_settings ss
                 JOIN settings_default_account sda ON sda.settings_id = ss.settings_id AND sda.active = true
                 LIMIT 1),
                (SELECT sda.profile_id::text
                 FROM default_settings ds
                 JOIN settings_default_account sda ON sda.settings_id = ds.settings_id AND sda.active = true
                 LIMIT 1)
            ) as default_account_profile_id
    )
    SELECT 
        s.id::text as settings_id,
        s.created_at as settings_created_at,
        s.active as settings_active,
        s.name as settings_name,
        s.description as settings_description,
        s.primary_color,
        s.accent,
        s.background,
        s.surface,
        s.success,
        s.warning,
        s.error,
        s.sidebar_background,
        s.sidebar_primary,
        s.chart1,
        s.chart2,
        s.chart3,
        s.chart4,
        s.chart5,
        s.guest_login_enabled,
        s.success_threshold,
        s.warning_threshold,
        s.danger_threshold,
        COALESCE(sad.auth_ids, ARRAY[]::text[]) as settings_auth_ids,
        COALESCE(sad.auth_mapping, '{}'::jsonb) as settings_auth_mapping,
        COALESCE(spd.provider_ids, ARRAY[]::text[]) as settings_provider_ids,
        COALESCE(spd.provider_mapping, '{}'::jsonb) as settings_provider_mapping,
        sdgd.default_guest_profile_id,
        sdad.default_account_profile_id
    FROM selected_settings ss
    JOIN settings s ON s.id = ss.settings_id
    LEFT JOIN settings_auths_data sad ON true
    LEFT JOIN settings_providers_data spd ON true
    LEFT JOIN settings_default_guest_data sdgd ON true
    LEFT JOIN settings_default_account_data sdad ON true
    LIMIT 1
)
SELECT 
    -- Emulation authorization flag
    ev.is_authorized,
    -- Actual profile fields (prefixed with actual_)
    apd.id as actual_id,
    apd.first_name as actual_first_name,
    apd.last_name as actual_last_name,
    apd.emails as actual_emails,
    apd.primary_email as actual_primary_email,
    apd.role as actual_role,
    apd.active as actual_active,
    apd.req_per_day as actual_req_per_day,
    apd.last_login as actual_last_login,
    apd.last_active as actual_last_active,
    apd.created_at as actual_created_at,
    apd.updated_at as actual_updated_at,
    apd.primary_department_id as actual_primary_department_id,
    -- Effective profile fields (unprefixed )
    epd.id,
    epd.first_name,
    epd.last_name,
    epd.emails,
    epd.primary_email,
    epd.role,
    epd.active,
    epd.req_per_day,
    epd.last_login,
    epd.last_active,
    epd.created_at,
    epd.updated_at,
    epd.primary_department_id,
    -- Context data (based on effective profile)
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'id', d.id::text,
            'title', d.title,
            'description', d.description,
            'active', d.active,
            'is_primary', d.is_primary
        ) ORDER BY d.is_primary DESC, d.title)
        FROM dept_data d),
        '[]'::jsonb
    ) as departments,
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'id', c.id::text,
            'title', c.title,
            'description', c.description,
            'active', c.active,
            'department_ids', c.department_ids
        ) ORDER BY c.title)
        FROM cohort_data c),
        '[]'::jsonb
    ) as cohorts,
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'id', s.id::text,
            'title', s.title,
            'description', s.description,
            'department_ids', s.department_ids,
            'time_limit', s.time_limit,
            'active', s.active,
            'practice_simulation', s.practice_simulation
        ) ORDER BY s.title)
        FROM sim_data s),
        '[]'::jsonb
    ) as simulations,
    (SELECT earliest FROM earliest_attempt) as earliest_attempt_date,
    (SELECT scoped_roles FROM scoped_roles_computed) as scoped_roles,
    -- Settings data (all fields prefixed with settings_)
    (SELECT settings_id FROM settings_resolution) as settings_id,
    (SELECT settings_created_at FROM settings_resolution) as settings_created_at,
    (SELECT settings_active FROM settings_resolution) as settings_active,
    (SELECT settings_name FROM settings_resolution) as settings_name,
    (SELECT settings_description FROM settings_resolution) as settings_description,
    (SELECT primary_color FROM settings_resolution) as settings_primary_color,
    (SELECT accent FROM settings_resolution) as settings_accent,
    (SELECT background FROM settings_resolution) as settings_background,
    (SELECT surface FROM settings_resolution) as settings_surface,
    (SELECT success FROM settings_resolution) as settings_success,
    (SELECT warning FROM settings_resolution) as settings_warning,
    (SELECT error FROM settings_resolution) as settings_error,
    (SELECT sidebar_background FROM settings_resolution) as settings_sidebar_background,
    (SELECT sidebar_primary FROM settings_resolution) as settings_sidebar_primary,
    (SELECT chart1 FROM settings_resolution) as settings_chart1,
    (SELECT chart2 FROM settings_resolution) as settings_chart2,
    (SELECT chart3 FROM settings_resolution) as settings_chart3,
    (SELECT chart4 FROM settings_resolution) as settings_chart4,
    (SELECT chart5 FROM settings_resolution) as settings_chart5,
    (SELECT guest_login_enabled FROM settings_resolution) as settings_guest_login_enabled,
    (SELECT success_threshold FROM settings_resolution) as settings_success_threshold,
    (SELECT warning_threshold FROM settings_resolution) as settings_warning_threshold,
    (SELECT danger_threshold FROM settings_resolution) as settings_danger_threshold,
    (SELECT settings_auth_ids FROM settings_resolution) as settings_auth_ids,
    (SELECT settings_auth_mapping FROM settings_resolution) as settings_auth_mapping,
    (SELECT settings_provider_ids FROM settings_resolution) as settings_provider_ids,
    (SELECT settings_provider_mapping FROM settings_resolution) as settings_provider_mapping,
    (SELECT default_guest_profile_id FROM settings_resolution) as settings_default_guest_profile_id,
    (SELECT default_account_profile_id FROM settings_resolution) as settings_default_account_profile_id
FROM emulation_validation ev
CROSS JOIN resolved_profile_ids rpi
CROSS JOIN actual_profile_data apd
CROSS JOIN effective_profile_data epd
CROSS JOIN scoped_roles_computed src
CROSS JOIN settings_resolution sr
WHERE ev.is_authorized = true  -- Only return data if emulation is authorized
  AND rpi.actual_profile_id IS NOT NULL  -- Ensure we have valid profile IDs
  AND rpi.effective_profile_id IS NOT NULL

