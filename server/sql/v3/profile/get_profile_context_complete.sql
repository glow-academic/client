-- Get profile context with guest-profile-id resolution and emulation validation in a single transaction
-- Parameters: $1=actualProfileId (may be "guest-profile-id"), $2=effectiveProfileId (may be "guest-profile-id")
-- Returns: Complete profile context data, or NULL if emulation is unauthorized
WITH resolve_profile_ids AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID for both actual and effective
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $1::uuid
        END as resolved_actual_profile_id,
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $2::uuid
        END as resolved_effective_profile_id
),
emulation_validation AS (
    -- Validate emulation is authorized when profiles differ
    SELECT 
        rpi.resolved_actual_profile_id,
        rpi.resolved_effective_profile_id,
        CASE 
            WHEN rpi.resolved_actual_profile_id = rpi.resolved_effective_profile_id THEN true  -- Same profile, always allowed
            ELSE (
                -- Check if effective profile is in simulatable list based on actual user's role
                SELECT EXISTS (
                    SELECT 1
                    FROM profiles p_actual
                    CROSS JOIN profiles p_effective
                    WHERE p_actual.id = rpi.resolved_actual_profile_id
                      AND p_effective.id = rpi.resolved_effective_profile_id
                      AND p_effective.id != rpi.resolved_actual_profile_id
                      AND CASE 
                        WHEN p_actual.role = 'superadmin' THEN true
                        WHEN p_actual.role = 'admin' THEN p_effective.role IN ('instructional', 'ta', 'guest')
                        WHEN p_actual.role = 'instructional' THEN p_effective.role IN ('ta', 'guest')
                        ELSE false
                      END
                )
            )
        END as is_authorized
    FROM resolve_profile_ids rpi
),
actual_profile_role AS (
    -- Use actual (logged-in) user's role for emulation permissions
    SELECT role FROM profiles p, resolve_profile_ids rpi WHERE p.id = rpi.resolved_actual_profile_id
),
effective_profile_role AS (
    -- Use effective profile's role for UI permissions filtering
    SELECT role FROM profiles p, resolve_profile_ids rpi WHERE p.id = rpi.resolved_effective_profile_id
),
scoped_roles_computed AS (
    -- Compute scoped roles based on effective profile's role
    SELECT 
        CASE 
            WHEN epr.role = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'ta', 'guest']::profile_role[]
            WHEN epr.role = 'admin' THEN ARRAY['admin', 'instructional', 'ta', 'guest']::profile_role[]
            WHEN epr.role = 'instructional' THEN ARRAY['instructional', 'ta', 'guest']::profile_role[]
            WHEN epr.role = 'ta' THEN ARRAY['ta']::profile_role[]
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
        p.viewed_intro,
        p.viewed_chat,
        p.default_profile,
        COALESCE(prl.requests_per_day, 0) as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM resolve_profile_ids rpi
    JOIN profiles p ON p.id = rpi.resolved_actual_profile_id
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
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, p.viewed_intro, p.viewed_chat, 
             p.default_profile, prl.requests_per_day, p.last_login, pa.last_active, 
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
        p.viewed_intro,
        p.viewed_chat,
        p.default_profile,
        COALESCE(prl.requests_per_day, 0) as req_per_day,
        p.last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM resolve_profile_ids rpi
    JOIN profiles p ON p.id = rpi.resolved_effective_profile_id
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
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, p.viewed_intro, p.viewed_chat, 
             p.default_profile, prl.requests_per_day, p.last_login, pa.last_active, 
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
    FROM resolve_profile_ids rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_effective_profile_id
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true
),
cohort_data AS (
    -- Cohorts for the effective profile
    SELECT DISTINCT
        c.id,
        c.title,
        c.description,
        c.active,
        COALESCE(cdd.department_ids, NULL) as department_ids
    FROM resolve_profile_ids rpi
    JOIN cohort_profiles pc ON pc.profile_id = rpi.resolved_effective_profile_id
    JOIN cohorts c ON c.id = pc.cohort_id
    LEFT JOIN (
        SELECT 
            cd.cohort_id,
            ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
        FROM cohort_departments cd
        WHERE cd.active = true
        GROUP BY cd.cohort_id
    ) cdd ON cdd.cohort_id = c.id
    WHERE pc.active = true
      AND c.active = true
),
sim_data AS (
    -- Simulations for the effective profile's cohorts
    SELECT DISTINCT
        s.id,
        s.title,
        s.description,
        COALESCE(sdd.department_ids, NULL) as department_ids,
        COALESCE(stl.time_limit_seconds, 0) as time_limit,
        s.active,
        s.practice_simulation
    FROM simulations s
    JOIN cohort_simulations cs ON cs.simulation_id = s.id
    JOIN cohort_data cd ON cd.id = cs.cohort_id
    LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
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
    FROM resolve_profile_ids rpi
    -- Get all departments for the effective profile
    JOIN profile_departments pd_effective ON pd_effective.profile_id = rpi.resolved_effective_profile_id
        AND pd_effective.active = true
    -- Get all profiles in those departments
    JOIN profile_departments pd_all ON pd_all.department_id = pd_effective.department_id
        AND pd_all.active = true
    -- Get attempts for those profiles
    JOIN attempt_profiles ap ON ap.profile_id = pd_all.profile_id
        AND ap.active = true
    JOIN simulation_attempts sa ON sa.id = ap.attempt_id
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
    apd.viewed_intro as actual_viewed_intro,
    apd.viewed_chat as actual_viewed_chat,
    apd.default_profile as actual_default_profile,
    apd.req_per_day as actual_req_per_day,
    apd.last_login as actual_last_login,
    apd.last_active as actual_last_active,
    apd.created_at as actual_created_at,
    apd.updated_at as actual_updated_at,
    apd.primary_department_id as actual_primary_department_id,
    -- Effective profile fields (unprefixed for backward compatibility)
    epd.id,
    epd.first_name,
    epd.last_name,
    epd.emails,
    epd.primary_email,
    epd.role,
    epd.active,
    epd.viewed_intro,
    epd.viewed_chat,
    epd.default_profile,
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
    (SELECT scoped_roles FROM scoped_roles_computed) as scoped_roles
FROM emulation_validation ev
CROSS JOIN actual_profile_data apd
CROSS JOIN effective_profile_data epd
CROSS JOIN scoped_roles_computed src
WHERE ev.is_authorized = true  -- Only return data if emulation is authorized

