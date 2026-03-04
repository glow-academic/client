-- Get profile context in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Business Logic Overview:
-- 1. Profile Resolution: Uses provided profile_id directly
-- 2. Scoped Roles: Computes roles that profile has scope to see (for UI filtering)
-- 3. Settings Resolution: Resolves settings with priority: department-specific → default → any active
-- 4. Collections: Returns arrays of composite types (departments, simulations) - NO JSONB
--
-- NOTE: Theme derivation (converting primitives to tokens) stays in Python because it requires
-- complex color math utilities (hex_to_oklch, ensure_contrast, shade, tint) that are not available
-- in PostgreSQL. The SQL returns theme primitives (colors as strings), and Python derives the
-- full ThemeTokens structure for the frontend.
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_profile_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_profile_context_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_profile_context_v4_department AS (
    department_id uuid,
    title text,
    description text,
    active boolean,
    is_primary boolean
);

CREATE TYPE types.q_get_profile_context_v4_simulation AS (
    simulation_id uuid,
    title text,
    description text,
    department_ids text[],
    time_limit integer,
    active boolean,
    practice_simulation boolean
);

CREATE TYPE types.q_get_profile_context_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    slug text
);

CREATE TYPE types.q_get_profile_context_v4_role_resource AS (
    role text,
    name text,
    description text,
    icon_value text,
    color_hex text
);

CREATE TYPE types.q_get_profile_context_v4_provider AS (
    provider_id text,
    name text,
    description text,
    value text
);

CREATE TYPE types.q_get_profile_context_v4_draft AS (
    id uuid,
    artifact_type text,
    payload jsonb,
    version int,
    updated_at timestamptz
);

CREATE TYPE types.q_get_profile_context_v4_theme_tokens AS (
    background text,
    foreground text,
    card text,
    card_foreground text,
    popover text,
    popover_foreground text,
    primary_color text,
    primary_foreground text,
    secondary text,
    secondary_foreground text,
    muted text,
    muted_foreground text,
    accent text,
    accent_foreground text,
    destructive text,
    border text,
    input text,
    ring text,
    success text,
    success_foreground text,
    warning text,
    warning_foreground text,
    info text,
    info_foreground text,
    chart1 text,
    chart2 text,
    chart3 text,
    chart4 text,
    chart5 text,
    sidebar text,
    sidebar_foreground text,
    sidebar_primary text,
    sidebar_primary_foreground text,
    sidebar_accent text,
    sidebar_accent_foreground text,
    sidebar_border text,
    sidebar_ring text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_profile_context_v4(
    profile_id uuid DEFAULT NULL,
    department_id text DEFAULT NULL
)
RETURNS TABLE (
    is_authorized boolean,
    -- Profile fields
    id uuid,
    name text,
    emails text[],
    primary_email text,
    role text,
    active boolean,
    req_per_day integer,
    last_login timestamptz,
    last_active timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    primary_department_id uuid,
    -- Context data (based on effective profile)
    departments types.q_get_profile_context_v4_department[],
    simulations types.q_get_profile_context_v4_simulation[],
    earliest_attempt_date timestamptz,
    scoped_roles text[],
    role_resources types.q_get_profile_context_v4_role_resource[],
    -- Settings data (all fields prefixed with settings_)
    settings_id text,
    settings_created_at timestamptz,
    settings_active boolean,
    settings_name text,
    settings_description text,
    settings_primary_color text,
    settings_accent text,
    settings_background text,
    settings_surface text,
    settings_success text,
    settings_warning text,
    settings_error text,
    settings_sidebar_background text,
    settings_sidebar_primary text,
    settings_chart1 text,
    settings_chart2 text,
    settings_chart3 text,
    settings_chart4 text,
    settings_chart5 text,
    settings_guest_login_enabled boolean,
    settings_success_threshold integer,
    settings_warning_threshold integer,
    settings_danger_threshold integer,
    settings_auth_ids text[],
    settings_auths types.q_get_profile_context_v4_auth[],
    settings_provider_key_ids uuid[],
    -- Computed fields
    redirect_path text,
    department_ids text[],
    simulation_ids text[],
    drafts types.q_get_profile_context_v4_draft[],
    settings_tokens types.q_get_profile_context_v4_theme_tokens,
    actor_name text,
    session_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        department_id AS department_id
),
profile_type AS (
    -- Use profile's role for UI permissions filtering
    -- Return NULL role when profile ID is NULL (for settings-only requests)
    SELECT
        COALESCE(
            (SELECT r.role FROM profile_roles_junction pr_j
             JOIN roles_resource r ON pr_j.role_id = r.id
             WHERE pr_j.profile_id = p.id
             LIMIT 1),
            NULL::profile_type
        ) as role
    FROM profile_artifact p WHERE p.id = (SELECT profile_id FROM params)
),
scoped_roles_computed AS (
    -- Compute scoped roles based on profile's role
    SELECT
        CASE
            WHEN pt.role = 'superadmin'::profile_type THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest', 'custom']::text[]
            WHEN pt.role = 'admin'::profile_type THEN ARRAY['admin', 'instructional', 'member', 'guest', 'custom']::text[]
            WHEN pt.role = 'instructional'::profile_type THEN ARRAY['instructional', 'member', 'guest']::text[]
            WHEN pt.role = 'member'::profile_type THEN ARRAY['member']::text[]
            ELSE ARRAY['guest']::text[]
        END as scoped_roles
    FROM profile_type pt
),
profile_data AS (
    -- Fetch the profile
    -- Return NULL values when profile ID is NULL (for settings-only requests)
    SELECT
        p.id,
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) as name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails_junction pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT r.role FROM profile_roles_junction pr_j
         JOIN roles_resource r ON pr_j.role_id = r.id
         WHERE pr_j.profile_id = p.id
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE) as active,
        COALESCE(rl.requests_per_day, 0) as req_per_day,
        (SELECT le.created_at FROM profiles_logins_connection plj JOIN logins_entry le ON le.id = plj.login_id WHERE plj.profiles_id = p.id ORDER BY le.created_at DESC LIMIT 1) as last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profile_artifact p
    LEFT JOIN profile_emails_junction pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_departments_junction pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT ae.created_at AS last_active
        FROM profiles_activity_connection pactj
        JOIN activity_entry ae ON ae.id = pactj.activity_id
        WHERE pactj.profiles_id = p.id
        ORDER BY ae.created_at DESC
        LIMIT 1
    ) pa ON true
    WHERE p.id = (SELECT profile_id FROM params)
    GROUP BY p.id, (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE),
             rl.requests_per_day, (SELECT le.created_at FROM profiles_logins_connection plj JOIN logins_entry le ON le.id = plj.login_id WHERE plj.profiles_id = p.id ORDER BY le.created_at DESC LIMIT 1), pa.last_active,
             p.created_at, p.updated_at, pd.department_id
    UNION ALL
    -- Return single row with NULL values when profile ID is NULL (for settings-only requests)
    SELECT
        NULL::uuid as id,
        NULL::text as name,
        NULL::text[] as emails,
        NULL::text as primary_email,
        NULL::profile_type as role,
        NULL::boolean as active,
        NULL::integer as req_per_day,
        NULL::timestamptz as last_login,
        NULL::timestamptz as last_active,
        NULL::timestamptz as created_at,
        NULL::timestamptz as updated_at,
        NULL::uuid as primary_department_id
    WHERE (SELECT profile_id FROM params) IS NULL
),
dept_data AS (
    -- Departments for the effective profile
    SELECT
        d.id as department_id,
        ddj.department_id as department_artifact_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1) as name,
        (SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = ddj.department_id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true) as active,
        pd.is_primary
    FROM profile_departments_junction pd
    JOIN departments_resource d ON d.id = pd.department_id
    JOIN department_departments_junction ddj ON ddj.departments_id = d.id
    WHERE pd.profile_id = (SELECT profile_id FROM params)
      AND pd.active = true
      AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
),
sim_data AS (
    -- Simulations for the effective profile's cohorts
    SELECT DISTINCT
        s.id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1),
        (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
        COALESCE(sdd.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.type = 'scenario_active' AND ssf.value = true)),
            0
        ) as time_limit,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = TRUE),
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE)
    FROM simulation_artifact s
    JOIN cohort_simulations_junction cs ON cs.simulation_id = s.id
    JOIN cohort_artifact ca ON ca.id = cs.cohort_id
    JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = ca.id
    JOIN cohorts_resource cr ON cr.id = ccj.cohorts_id
    JOIN profile_profiles_junction ppj_sim ON ppj_sim.profile_id = (SELECT profile_id FROM params)
    JOIN profiles_resource pr_sim ON pr_sim.id = ppj_sim.profiles_id AND pr_sim.id = ANY(cr.profile_ids)
    LEFT JOIN (
        SELECT
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments_junction sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
),
departments_aggregated AS (
    -- Aggregate departments into composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (d.department_id, d.name, d.description, d.active, d.is_primary)::types.q_get_profile_context_v4_department
                ORDER BY d.is_primary DESC, d.name
            ),
            '{}'::types.q_get_profile_context_v4_department[]
        ) as departments
    FROM dept_data d
),
simulations_aggregated AS (
    -- Aggregate simulations into composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (s.id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), s.department_ids, s.time_limit, EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = TRUE), EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE))::types.q_get_profile_context_v4_simulation
                ORDER BY (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
            ),
            '{}'::types.q_get_profile_context_v4_simulation[]
        ) as simulations
    FROM sim_data s
),
earliest_attempt AS (
    -- Earliest attempt across all departments the effective profile belongs to
    -- Uses unified attempts from general and practice entry tables
    WITH all_attempts AS (
        SELECT id, created_at FROM attempt_entry
    ),
    all_attempt_profiles AS (
        SELECT apc.attempt_id, apc.profiles_id
        FROM attempt_profiles_connection apc
        WHERE apc.active = true
    )
    SELECT MIN(sa.created_at) as earliest
    -- Get all departments for the effective profile
    FROM profile_departments_junction pd_effective
    -- Get all profiles in those departments
    JOIN profile_departments_junction pd_all ON pd_all.department_id = pd_effective.department_id
        AND pd_all.active = true
    -- Get attempts for those profiles (via attempt_profiles_connection)
    JOIN profile_profiles_junction ppj ON ppj.profile_id = pd_all.profile_id
    JOIN all_attempt_profiles aap ON aap.profiles_id = ppj.profiles_id
    JOIN all_attempts sa ON sa.id = aap.attempt_id
    WHERE pd_effective.profile_id = (SELECT profile_id FROM params)
      AND pd_effective.active = true
),
settings_resolution AS (
    -- Resolve settings based on effective profile's department OR department_id parameter
    -- Logic: department-specific → default → any active
    -- When no profile exists, use department_id parameter directly
    WITH default_settings AS (
        -- Get settings with no department links (cross-department/default)
        SELECT s.id as settings_id
        FROM setting_artifact s
        WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
          AND NOT EXISTS (
              SELECT 1 FROM department_settings_junction sd 
              WHERE sd.settings_id = s.id AND sd.active = true
          )
        LIMIT 1
    ),
    profile_department AS (
        -- Get profile's primary department (if profile exists)
        SELECT pd.department_id
        FROM params p
        JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id
        WHERE p.profile_id IS NOT NULL
          AND pd.is_primary = TRUE
          AND pd.active = true
        LIMIT 1
    ),
    resolved_department_id AS (
        -- Use profile's department if available, otherwise use department_id parameter
        SELECT COALESCE(
            (SELECT department_id FROM profile_department),
            (SELECT CASE 
                WHEN department_id IS NOT NULL AND department_id != '' THEN department_id::uuid
                ELSE NULL::uuid
            END FROM params)
        ) as department_id
    ),
    dept_specific_settings AS (
        -- Get department-specific settings (if department exists FROM profile_artifact OR parameter)
        SELECT s.id as settings_id
        FROM setting_artifact s
        JOIN department_settings_junction sd ON sd.settings_id = s.id
        CROSS JOIN resolved_department_id rdi
        WHERE rdi.department_id IS NOT NULL
          AND sd.department_id = rdi.department_id
          AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) 
          AND sd.active = true
        LIMIT 1
    ),
    selected_settings AS (
        -- Priority: department-specific settings, then default, then any active
        SELECT 
            COALESCE(
                (SELECT settings_id FROM dept_specific_settings),
                (SELECT settings_id FROM default_settings),
                (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)
            ) as settings_id
    ),
    settings_auths_data AS (
        -- Get linked auths for this settings
        SELECT 
            ARRAY_AGG(a.id::text ORDER BY (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)) as auth_ids,
            COALESCE(
                ARRAY_AGG(
                    (a.id, (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), COALESCE((SELECT d.description FROM auth_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), ''), (SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1))::types.q_get_profile_context_v4_auth
                    ORDER BY (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)
                ),
                '{}'::types.q_get_profile_context_v4_auth[]
            ) as auths
        FROM selected_settings ss
        JOIN setting_auths_junction sa ON sa.settings_id = ss.settings_id AND sa.active = true
        JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
    ),
    settings_provider_keys_data AS (
        -- Get provider_key_ids from settings_resource
        SELECT
            COALESCE(sr.provider_key_ids, ARRAY[]::uuid[]) as provider_key_ids
        FROM selected_settings ss
        JOIN setting_settings_junction ssj ON ssj.setting_id = ss.settings_id AND ssj.active = true
        JOIN settings_resource sr ON sr.id = ssj.settings_id
        LIMIT 1
    )
    SELECT 
        s.id::text as settings_id,
        s.created_at as settings_created_at,
        EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) as settings_active,
        (SELECT n.name FROM setting_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1) as settings_name,
        (SELECT d.description FROM setting_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1) as settings_description,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::color_type LIMIT 1) as primary_color,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::color_type LIMIT 1) as accent,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'background'::color_type LIMIT 1) as background,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'surface'::color_type LIMIT 1) as surface,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'success'::color_type LIMIT 1) as success,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'warning'::color_type LIMIT 1) as warning,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'error'::color_type LIMIT 1) as error,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_background'::color_type LIMIT 1) as sidebar_background,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_primary'::color_type LIMIT 1) as sidebar_primary,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart1'::color_type LIMIT 1) as chart1,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart2'::color_type LIMIT 1) as chart2,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart3'::color_type LIMIT 1) as chart3,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart4'::color_type LIMIT 1) as chart4,
        (SELECT c.hex_code FROM setting_colors_junction sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart5'::color_type LIMIT 1) as chart5,
        EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE) as settings_guest_login_enabled,
        (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'success'::threshold_type LIMIT 1) as success_threshold,
        (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'warning'::threshold_type LIMIT 1) as warning_threshold,
        (SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'danger'::threshold_type LIMIT 1) as danger_threshold,
        COALESCE(sad.auth_ids, ARRAY[]::text[]) as settings_auth_ids,
        COALESCE(sad.auths, '{}'::types.q_get_profile_context_v4_auth[]) as settings_auths,
        COALESCE(spkd.provider_key_ids, ARRAY[]::uuid[]) as settings_provider_key_ids
    FROM selected_settings ss
    JOIN setting_artifact s ON s.id = ss.settings_id::uuid
    LEFT JOIN settings_auths_data sad ON true
    LEFT JOIN settings_provider_keys_data spkd ON true
    LIMIT 1
),
roles_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (r.role::text, r.name, r.description, i.value, c.hex_code)::types.q_get_profile_context_v4_role_resource
                ORDER BY r.name
            ),
            '{}'::types.q_get_profile_context_v4_role_resource[]
        ) as role_resources
    FROM roles_resource r
    LEFT JOIN icons_resource i ON i.id = r.icon_id
    LEFT JOIN colors_resource c ON c.id = r.color_id
    WHERE r.active = true
),
actor_name_computed AS (
    -- Compute actor_name from profile_id
    -- Return NULL when profile ID is NULL (for settings-only requests)
    SELECT
        (SELECT COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '')
         FROM profile_artifact p
         WHERE p.id = (SELECT profile_id FROM params) LIMIT 1) as actor_name
),
redirect_path_computed AS (
    -- Compute redirect path based on profile's role
    -- Replicates get_redirect_path_for_role logic
    -- Return NULL when role is NULL (for settings-only requests)
    SELECT
        CASE
            WHEN pt.role IS NULL THEN NULL::text
            WHEN pt.role = 'guest'::profile_type THEN '/practice'::text
            WHEN pt.role = 'member'::profile_type THEN '/home'::text
            WHEN pt.role = 'instructional'::profile_type THEN '/analytics/dashboard'::text
            WHEN pt.role = 'admin'::profile_type THEN '/analytics/dashboard'::text
            WHEN pt.role = 'superadmin'::profile_type THEN '/analytics/dashboard'::text
            ELSE '/home'::text
        END as redirect_path
    FROM profile_type pt
),
department_ids_computed AS (
    -- Extract department IDs from dept_data
    SELECT 
        COALESCE(
            ARRAY_AGG(d.department_id::text ORDER BY d.is_primary DESC, d.name),
            ARRAY[]::text[]
        ) as department_ids
    FROM dept_data d
),
simulation_ids_computed AS (
    -- Extract simulation IDs from sim_data
    SELECT 
        COALESCE(
            ARRAY_AGG(s.id::text ORDER BY (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)),
            ARRAY[]::text[]
        ) as simulation_ids
    FROM sim_data s
),
drafts_data AS (
    -- Get all drafts for effective profile
    -- Draft data is now stored in draft_* junction tables, not in payload
    -- Must join through profile_profiles_junction to translate profile_id -> profiles_id
    SELECT
        d.id,
        d.artifact::text as artifact_type,
        NULL::jsonb as payload,
        d.version,
        d.updated_at
    FROM profile_profiles_junction ppj
    JOIN profile_drafts_profiles_connection pdc ON pdc.profiles_id = ppj.profiles_id
    JOIN (SELECT id, 'agent'::text as artifact, version, created_at as updated_at FROM agent_drafts_entry
     UNION ALL SELECT id, 'auth', version, created_at FROM auth_drafts_entry
     UNION ALL SELECT id, 'cohort', version, created_at FROM cohort_drafts_entry
     UNION ALL SELECT id, 'department', version, created_at FROM department_drafts_entry
     UNION ALL SELECT id, 'document', version, created_at FROM document_drafts_entry
     UNION ALL SELECT id, 'eval', version, created_at FROM eval_drafts_entry
     UNION ALL SELECT id, 'field', version, created_at FROM field_drafts_entry
     UNION ALL SELECT id, 'model', version, created_at FROM model_drafts_entry
     UNION ALL SELECT id, 'parameter', version, created_at FROM parameter_drafts_entry
     UNION ALL SELECT id, 'persona', version, created_at FROM persona_drafts_entry
     UNION ALL SELECT id, 'profile', version, created_at FROM profile_drafts_entry
     UNION ALL SELECT id, 'provider', version, created_at FROM provider_drafts_entry
     UNION ALL SELECT id, 'rubric', version, created_at FROM rubric_drafts_entry
     UNION ALL SELECT id, 'scenario', version, created_at FROM scenario_drafts_entry
     UNION ALL SELECT id, 'setting', version, created_at FROM setting_drafts_entry
     UNION ALL SELECT id, 'simulation', version, created_at FROM simulation_drafts_entry
     UNION ALL SELECT id, 'suite', version, created_at FROM invocation_drafts_entry
     UNION ALL SELECT id, 'tool', version, created_at FROM tool_drafts_entry
     UNION ALL SELECT id, 'training', version, created_at FROM chat_drafts_entry) d ON d.id = pdc.draft_id
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
),
drafts_aggregated AS (
    -- Aggregate drafts as array of composite types
    SELECT
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.artifact_type, dd.payload, dd.version, dd.updated_at)::types.q_get_profile_context_v4_draft
                ORDER BY dd.updated_at DESC
            ),
            '{}'::types.q_get_profile_context_v4_draft[]
        ) as drafts
    FROM drafts_data dd
),
session_resolution AS (
    SELECT id as session_id
    FROM sessions_entry
    WHERE profile_id = (SELECT profile_id FROM params)
      AND active = true
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    -- Authorization flag (always true when profile exists)
    (pd.id IS NOT NULL)::boolean as is_authorized,
    -- Profile fields
    pd.id,
    pd.name,
    COALESCE(pd.emails, ARRAY[]::text[]) as emails,
    pd.primary_email,
    pd.role,
    pd.active,
    pd.req_per_day,
    pd.last_login,
    pd.last_active,
    pd.created_at,
    pd.updated_at,
    pd.primary_department_id,
    -- Context data (based on effective profile) - using composite types
    da.departments as departments,
    sa.simulations as simulations,
    (SELECT earliest FROM earliest_attempt) as earliest_attempt_date,
    (SELECT scoped_roles FROM scoped_roles_computed) as scoped_roles,
    (SELECT role_resources FROM roles_data) as role_resources,
    -- Settings data (all fields prefixed with settings_)
    sr.settings_id as settings_id,
    sr.settings_created_at as settings_created_at,
    sr.settings_active as settings_active,
    sr.settings_name as settings_name,
    sr.settings_description as settings_description,
    sr.primary_color as settings_primary_color,
    sr.accent as settings_accent,
    sr.background as settings_background,
    sr.surface as settings_surface,
    sr.success as settings_success,
    sr.warning as settings_warning,
    sr.error as settings_error,
    sr.sidebar_background as settings_sidebar_background,
    sr.sidebar_primary as settings_sidebar_primary,
    sr.chart1 as settings_chart1,
    sr.chart2 as settings_chart2,
    sr.chart3 as settings_chart3,
    sr.chart4 as settings_chart4,
    sr.chart5 as settings_chart5,
    sr.settings_guest_login_enabled as settings_guest_login_enabled,
    sr.success_threshold as settings_success_threshold,
    sr.warning_threshold as settings_warning_threshold,
    sr.danger_threshold as settings_danger_threshold,
    sr.settings_auth_ids as settings_auth_ids,
    sr.settings_auths as settings_auths,
    sr.settings_provider_key_ids as settings_provider_key_ids,
    -- Computed fields
    (SELECT redirect_path FROM redirect_path_computed) as redirect_path,
    (SELECT department_ids FROM department_ids_computed) as department_ids,
    (SELECT simulation_ids FROM simulation_ids_computed) as simulation_ids,
    (SELECT drafts FROM drafts_aggregated) as drafts,
    -- Return empty theme tokens struct for type introspection (Python will override with computed values)
    -- 37 fields: background, foreground, card, card_foreground, popover, popover_foreground, primary_color, primary_foreground, secondary, secondary_foreground, muted, muted_foreground, accent, accent_foreground, destructive, border, input, ring, success, success_foreground, warning, warning_foreground, info, info_foreground, chart1, chart2, chart3, chart4, chart5, sidebar, sidebar_foreground, sidebar_primary, sidebar_primary_foreground, sidebar_accent, sidebar_accent_foreground, sidebar_border, sidebar_ring
    ('', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '')::types.q_get_profile_context_v4_theme_tokens as settings_tokens,
    (SELECT actor_name FROM actor_name_computed) as actor_name,
    (SELECT session_id FROM session_resolution) as session_id
FROM params
CROSS JOIN profile_data pd
CROSS JOIN scoped_roles_computed src
CROSS JOIN settings_resolution sr
CROSS JOIN departments_aggregated da
CROSS JOIN simulations_aggregated sa
CROSS JOIN actor_name_computed anc
CROSS JOIN redirect_path_computed rpc
CROSS JOIN department_ids_computed dic
CROSS JOIN simulation_ids_computed sic
CROSS JOIN drafts_aggregated da_drafts
WHERE (
    -- Standard case: profile exists
    (params.profile_id IS NOT NULL AND pd.id IS NOT NULL)
    OR
    -- Settings-only case: allow NULL profile ID when department_id is provided (for login page theme)
    (params.profile_id IS NULL
     AND params.department_id IS NOT NULL
     AND params.department_id != '')
)
$$;
