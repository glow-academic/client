-- Get profile context with emulation validation in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Business Logic Overview:
-- 1. Profile Resolution: Resolves profile IDs from cookies (department-id, auth-mode) when profile IDs are null
--    - Supports guest/default-account login via cookies
--    - Falls back to default settings if no department-specific settings exist
-- 2. Emulation Validation: Validates that actual profile can emulate effective profile based on role hierarchy
--    - superadmin can emulate anyone
--    - admin can emulate instructional/member/guest
--    - instructional can emulate member/guest
--    - member/guest cannot emulate others
-- 3. Scoped Roles: Computes roles that effective profile has scope to see (for UI filtering)
-- 4. Settings Resolution: Resolves settings with priority: department-specific → default → any active
-- 5. Collections: Returns arrays of composite types (departments, cohorts, simulations) - NO JSONB
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

CREATE TYPE types.q_get_profile_context_v4_cohort AS (
    cohort_id uuid,
    title text,
    description text,
    active boolean,
    department_ids text[]
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
    actual_profile_id uuid DEFAULT NULL,
    effective_profile_id uuid DEFAULT NULL,
    department_id text DEFAULT NULL,
    auth_mode text DEFAULT NULL
)
RETURNS TABLE (
    is_authorized boolean,
    -- Authorization check fields (for default-account and guest login validation)
    guest_login_enabled boolean,
    active_departments_count bigint,
    department_auth_providers_count bigint,
    default_settings_auth_providers_count bigint,
    departments_without_auth_providers_count bigint,
    department_exists boolean,
    -- Actual profile fields (prefixed with actual_)
    actual_id uuid,
    actual_first_name text,
    actual_last_name text,
    actual_emails text[],
    actual_primary_email text,
    actual_role text,
    actual_active boolean,
    actual_req_per_day integer,
    actual_last_login timestamptz,
    actual_last_active timestamptz,
    actual_created_at timestamptz,
    actual_updated_at timestamptz,
    actual_primary_department_id uuid,
    -- Effective profile fields (unprefixed)
    id uuid,
    first_name text,
    last_name text,
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
    cohorts types.q_get_profile_context_v4_cohort[],
    simulations types.q_get_profile_context_v4_simulation[],
    earliest_attempt_date timestamptz,
    scoped_roles text[],
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
    settings_provider_ids text[],
    settings_providers types.q_get_profile_context_v4_provider[],
    settings_default_guest_profile_id text,
    settings_default_account_profile_id text,
    -- Computed fields
    available_sections text[],
    redirect_path text,
    department_ids text[],
    cohort_ids text[],
    simulation_ids text[],
    drafts types.q_get_profile_context_v4_draft[],
    settings_tokens types.q_get_profile_context_v4_theme_tokens,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        actual_profile_id AS actual_profile_id,
        effective_profile_id AS effective_profile_id,
        department_id AS department_id,
        auth_mode AS auth_mode
),
params_normalized AS (
    -- Normalize department_id: convert empty string to NULL
    SELECT 
        CASE 
            WHEN department_id IS NULL OR department_id = '' THEN NULL::uuid
            ELSE department_id::uuid
        END as department_id_uuid
    FROM params
),
-- Authorization check CTEs (merged from check_login_authorization_complete.sql)
default_settings_for_auth AS (
    -- Get settings with no department links (cross-department/default)
    SELECT 
        s.id as settings_id,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE) as guest_login_enabled
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings_for_auth AS (
    -- Get department-specific settings (if department_id provided)
    SELECT 
        s.id as settings_id,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE) as guest_login_enabled
    FROM setting_artifact s
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    CROSS JOIN params_normalized pn
    WHERE pn.department_id_uuid IS NOT NULL
      AND ds.department_id = pn.department_id_uuid
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
    LIMIT 1
),
selected_settings_for_auth AS (
    -- Priority: department-specific settings, then default, then any active
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_for_auth),
            (SELECT settings_id FROM default_settings_for_auth),
            (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'active' AND sf.value = TRUE) LIMIT 1)
        ) as settings_id,
        COALESCE(
            (SELECT guest_login_enabled FROM dept_specific_settings_for_auth),
            (SELECT guest_login_enabled FROM default_settings_for_auth),
            false
        ) as guest_login_enabled
),
active_departments_count AS (
    -- Count all active departments
    SELECT COUNT(*) as count
    FROM department_artifact
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = department_artifact.id AND f.name = 'active' AND df.value = true)
),
department_exists_check AS (
    -- Check if the specified department exists and is active (if department_id provided)
    SELECT 
        CASE 
            WHEN pn.department_id_uuid IS NOT NULL THEN
                EXISTS(
                    SELECT 1 FROM department_artifact d
                    WHERE d.id = pn.department_id_uuid
                    AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
                )
            ELSE false
        END as department_exists
    FROM params_normalized pn
),
department_auth_providers_count AS (
    -- Count auth providers for specific department (if department_id provided)
    SELECT COUNT(DISTINCT a.id) as count
    FROM department_artifact d
    JOIN department_settings ds ON ds.department_id = d.id AND ds.active = true
    JOIN setting_artifact s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'active' AND af.value = true)
    CROSS JOIN params_normalized pn
    WHERE pn.department_id_uuid IS NOT NULL
      AND d.id = pn.department_id_uuid
      AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
),
default_settings_auth_providers_count AS (
    -- Count auth providers for default settings (no department links)
    SELECT COUNT(DISTINCT a.id) as count
    FROM default_settings_for_auth ds
    JOIN setting_artifact s ON s.id = ds.settings_id
    JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
    JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'active' AND af.value = true)
),
departments_without_auth_providers_count AS (
    -- Count departments that have no auth providers configured
    SELECT COUNT(DISTINCT d.id) as count
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
      AND NOT EXISTS (
          SELECT 1
          FROM department_settings ds
          JOIN setting_artifact s ON s.id = ds.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
          JOIN setting_auths sa ON sa.settings_id = s.id AND sa.active = true
          JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'active' AND af.value = true)
          WHERE ds.department_id = d.id
            AND ds.active = true
      )
),
resolve_profile_from_department AS (
    -- Resolve profile ID FROM department_artifact settings when profile IDs are null
    -- This happens when user is accessing via guest/default-account cookies
    -- department-id can be NULL for default settings (no department-specific settings)
    SELECT 
        CASE 
            -- If both profile IDs are null and we have auth_mode, resolve FROM setting_artifact
            WHEN (SELECT actual_profile_id FROM params) IS NULL 
                 AND (SELECT effective_profile_id FROM params) IS NULL 
                 AND (SELECT auth_mode FROM params) IN ('default-guest', 'default-account') THEN
                COALESCE(
                    -- Try department-specific settings first (only if department_id is provided)
                    CASE 
                        WHEN (SELECT department_id FROM params) IS NOT NULL 
                             AND (SELECT department_id FROM params) != '' THEN
                            CASE 
                                WHEN (SELECT auth_mode FROM params) = 'default-guest' THEN
                                    (SELECT dar.profile_id
                                     FROM setting_artifact s
                                     JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                     JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                                     JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                                     WHERE ds.department_id = (SELECT department_id FROM params)::uuid 
                                     AND dar.type = 'guest'::default_account_type
                                     AND dar.active = true
                                     AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
                                     LIMIT 1)
                                WHEN (SELECT auth_mode FROM params) = 'default-account' THEN
                                    (SELECT dar.profile_id
                                     FROM setting_artifact s
                                     JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                     JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                                     JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                                     WHERE ds.department_id = (SELECT department_id FROM params)::uuid 
                                     AND dar.type = 'admin'::default_account_type
                                     AND dar.active = true
                                     AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
                                     LIMIT 1)
                            END
                        ELSE NULL::uuid
                    END,
                    -- Fallback to default settings (no department links) - always try this
                    CASE 
                        WHEN (SELECT auth_mode FROM params) = 'default-guest' THEN
                            (SELECT dar.profile_id
                             FROM setting_artifact s
                             JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                             JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                             WHERE dar.type = 'guest'::default_account_type
                             AND dar.active = true
                             AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
                               AND NOT EXISTS (
                                   SELECT 1 FROM department_settings ds 
                                   WHERE ds.settings_id = s.id AND ds.active = true
                               )
                             LIMIT 1)
                        WHEN (SELECT auth_mode FROM params) = 'default-account' THEN
                            (SELECT dar.profile_id
                             FROM setting_artifact s
                             JOIN setting_default_accounts sda ON sda.setting_id = s.id AND sda.active = true
                             JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                             WHERE dar.type = 'admin'::default_account_type
                             AND dar.active = true
                             AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
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
    -- Use provided profile IDs if available, otherwise use resolved profile FROM department_artifact
    SELECT 
        COALESCE((SELECT actual_profile_id FROM params), (SELECT resolved_profile_id FROM resolve_profile_from_department)) as actual_profile_id,
        COALESCE((SELECT effective_profile_id FROM params), (SELECT resolved_profile_id FROM resolve_profile_from_department)) as effective_profile_id
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
                    FROM profile_artifact p_actual
                    JOIN profile_artifact p_effective ON p_effective.id = (SELECT effective_profile_id FROM resolved_profile_ids)
                    WHERE p_actual.id = (SELECT actual_profile_id FROM resolved_profile_ids)
                      AND p_effective.id != p_actual.id
                      AND CASE 
                        WHEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p_actual.id LIMIT 1) = 'superadmin'::profile_role THEN true
                        WHEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p_actual.id LIMIT 1) = 'admin'::profile_role THEN (SELECT r2.role FROM profile_roles pr_j2 JOIN roles_resource r2 ON pr_j2.role_id = r2.id WHERE pr_j2.profile_id = p_effective.id LIMIT 1) IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)
                        WHEN (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p_actual.id LIMIT 1) = 'instructional'::profile_role THEN (SELECT r2.role FROM profile_roles pr_j2 JOIN roles_resource r2 ON pr_j2.role_id = r2.id WHERE pr_j2.profile_id = p_effective.id LIMIT 1) IN ('member'::profile_role, 'guest'::profile_role)
                        ELSE false
                      END
                )
            )
        END as is_authorized
),
actual_profile_role AS (
    -- Use actual (logged-in) user's role for emulation permissions
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            LIMIT 1) as role 
    FROM profile_artifact p WHERE p.id = (SELECT actual_profile_id FROM resolved_profile_ids)
),
effective_profile_role AS (
    -- Use effective profile's role for UI permissions filtering
    -- Return NULL role when profile ID is NULL (for settings-only requests)
    SELECT 
        COALESCE(
            (SELECT r.role FROM profile_roles pr_j 
             JOIN roles_resource r ON pr_j.role_id = r.id 
             WHERE pr_j.profile_id = p.id 
             LIMIT 1),
            NULL::profile_role
        ) as role
    FROM profile_artifact p WHERE p.id = (SELECT effective_profile_id FROM resolved_profile_ids)
),
scoped_roles_computed AS (
    -- Compute scoped roles based on effective profile's role
    SELECT 
        CASE 
            WHEN epr.role = 'superadmin'::profile_role THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[]
            WHEN epr.role = 'admin'::profile_role THEN ARRAY['admin', 'instructional', 'member', 'guest']::text[]
            WHEN epr.role = 'instructional'::profile_role THEN ARRAY['instructional', 'member', 'guest']::text[]
            WHEN epr.role = 'member'::profile_role THEN ARRAY['member']::text[]
            ELSE ARRAY['guest']::text[]
        END as scoped_roles
    FROM effective_profile_role epr
),
actual_profile_data AS (
    -- Fetch the logged-in user's profile
    -- Return NULL values when profile ID is NULL (for settings-only requests)
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE) as active,
        COALESCE(rl.requests_per_day, 0) as req_per_day,
        (SELECT l.last_login FROM profile_logins pl JOIN logins_resource l ON pl.login_id = l.id WHERE pl.profile_id = p.id LIMIT 1) as last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profile_artifact p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id = (SELECT actual_profile_id FROM resolved_profile_ids)
    GROUP BY p.id, (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE), 
             rl.requests_per_day, (SELECT l.last_login FROM profile_logins pl JOIN logins_resource l ON pl.login_id = l.id WHERE pl.profile_id = p.id LIMIT 1), pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
    UNION ALL
    -- Return single row with NULL values when profile ID is NULL (for settings-only requests)
    SELECT 
        NULL::uuid as id,
        NULL::text as first_name,
        NULL::text as last_name,
        NULL::text[] as emails,
        NULL::text as primary_email,
        NULL::profile_role as role,
        NULL::boolean as active,
        NULL::integer as req_per_day,
        NULL::timestamptz as last_login,
        NULL::timestamptz as last_active,
        NULL::timestamptz as created_at,
        NULL::timestamptz as updated_at,
        NULL::uuid as primary_department_id
    WHERE (SELECT actual_profile_id FROM resolved_profile_ids) IS NULL
),
effective_profile_data AS (
    -- Fetch the profile being viewed (could be same as actual or emulated)
    -- Return NULL values when profile ID is NULL (for settings-only requests)
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE) as active,
        COALESCE(rl.requests_per_day, 0) as req_per_day,
        (SELECT l.last_login FROM profile_logins pl JOIN logins_resource l ON pl.login_id = l.id WHERE pl.profile_id = p.id LIMIT 1) as last_login,
        pa.last_active,
        p.created_at,
        p.updated_at,
        pd.department_id as primary_department_id
    FROM profile_artifact p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    WHERE p.id = (SELECT effective_profile_id FROM resolved_profile_ids)
    GROUP BY p.id, (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE), 
             rl.requests_per_day, (SELECT l.last_login FROM profile_logins pl JOIN logins_resource l ON pl.login_id = l.id WHERE pl.profile_id = p.id LIMIT 1), pa.last_active, 
             p.created_at, p.updated_at, pd.department_id
    UNION ALL
    -- Return single row with NULL values when profile ID is NULL (for settings-only requests)
    SELECT 
        NULL::uuid as id,
        NULL::text as first_name,
        NULL::text as last_name,
        NULL::text[] as emails,
        NULL::text as primary_email,
        NULL::profile_role as role,
        NULL::boolean as active,
        NULL::integer as req_per_day,
        NULL::timestamptz as last_login,
        NULL::timestamptz as last_active,
        NULL::timestamptz as created_at,
        NULL::timestamptz as updated_at,
        NULL::uuid as primary_department_id
    WHERE (SELECT effective_profile_id FROM resolved_profile_ids) IS NULL
),
dept_data AS (
    -- Departments for the effective profile
    SELECT 
        d.id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
        (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1),
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true),
        pd.is_primary
    FROM profile_departments pd
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT effective_profile_id FROM resolved_profile_ids)
      AND pd.active = true
      AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
),
cohort_data AS (
    -- Cohorts for the effective profile
    SELECT DISTINCT
        c.id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1),
        (SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1),
        EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = TRUE),
        COALESCE(cdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM cohort_profiles pc
    JOIN cohort_artifact c ON c.id = pc.cohort_id
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
      AND EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
),
sim_data AS (
    -- Simulations for the effective profile's cohorts
    SELECT DISTINCT
        s.id,
        (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1),
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
        COALESCE(sdd.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN flags_resource f ON ssf.scenario_flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND f.name = 'active' AND ssf.value = true)),
            0
        ) as time_limit,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'active' AND sf.value = TRUE),
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE)
    FROM simulation_artifact s
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
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
),
departments_aggregated AS (
    -- Aggregate departments into composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1), (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true), d.is_primary)::types.q_get_profile_context_v4_department
                ORDER BY d.is_primary DESC, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
            ),
            '{}'::types.q_get_profile_context_v4_department[]
        ) as departments
    FROM dept_data d
),
cohorts_aggregated AS (
    -- Aggregate cohorts into composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (c.id, (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1), (SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = TRUE), c.department_ids)::types.q_get_profile_context_v4_cohort
                ORDER BY (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)
            ),
            '{}'::types.q_get_profile_context_v4_cohort[]
        ) as cohorts
    FROM cohort_data c
),
simulations_aggregated AS (
    -- Aggregate simulations into composite type array
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (s.id, (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), s.department_ids, s.time_limit, EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'active' AND sf.value = TRUE), EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'practice' AND sf.value = TRUE))::types.q_get_profile_context_v4_simulation
                ORDER BY (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
            ),
            '{}'::types.q_get_profile_context_v4_simulation[]
        ) as simulations
    FROM sim_data s
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
    -- Resolve settings based on effective profile's department OR department_id parameter
    -- Logic: department-specific → default → any active
    -- When no profile exists, use department_id parameter directly
    WITH default_settings AS (
        -- Get settings with no department links (cross-department/default)
        SELECT s.id as settings_id
        FROM setting_artifact s
        WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE)
          AND NOT EXISTS (
              SELECT 1 FROM department_settings sd 
              WHERE sd.settings_id = s.id AND sd.active = true
          )
        LIMIT 1
    ),
    effective_profile_department AS (
        -- Get effective profile's primary department (if profile exists)
        SELECT pd.department_id
        FROM resolved_profile_ids rpi
        JOIN profile_departments pd ON pd.profile_id = rpi.effective_profile_id
        WHERE rpi.effective_profile_id IS NOT NULL
          AND pd.is_primary = TRUE 
          AND pd.active = true
        LIMIT 1
    ),
    resolved_department_id AS (
        -- Use profile's department if available, otherwise use department_id parameter
        -- Cast department_id from params to UUID to match effective_profile_department type
        SELECT COALESCE(
            (SELECT department_id FROM effective_profile_department),
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
        JOIN department_settings sd ON sd.settings_id = s.id
        CROSS JOIN resolved_department_id rdi
        WHERE rdi.department_id IS NOT NULL
          AND sd.department_id = rdi.department_id
          AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE) 
          AND sd.active = true
        LIMIT 1
    ),
    selected_settings AS (
        -- Priority: department-specific settings, then default, then any active
        SELECT 
            COALESCE(
                (SELECT settings_id FROM dept_specific_settings),
                (SELECT settings_id FROM default_settings),
                (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'active' AND sf.value = TRUE) LIMIT 1)
            ) as settings_id
    ),
    settings_auths_data AS (
        -- Get linked auths for this settings
        SELECT 
            ARRAY_AGG(a.id::text ORDER BY (SELECT n.name FROM auth_names an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)) as auth_ids,
            COALESCE(
                ARRAY_AGG(
                    (a.id, (SELECT n.name FROM auth_names an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), COALESCE((SELECT d.description FROM auth_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), ''), (SELECT s.value FROM auth_slugs as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1))::types.q_get_profile_context_v4_auth
                    ORDER BY (SELECT n.name FROM auth_names an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1)
                ),
                '{}'::types.q_get_profile_context_v4_auth[]
            ) as auths
        FROM selected_settings ss
        JOIN setting_auths sa ON sa.settings_id = ss.settings_id AND sa.active = true
        JOIN auths_resource a ON a.id = sa.auth_id AND EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'active' AND af.value = true)
    ),
    settings_providers_data AS (
        -- Get linked providers for this settings (providers is now a resource table)
        SELECT 
            ARRAY_AGG(n.name ORDER BY n.name) as provider_ids,
            COALESCE(
                ARRAY_AGG(
                    (p.id::text, n.name, COALESCE((SELECT d.description FROM provider_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''), n.name)::types.q_get_profile_context_v4_provider
                    ORDER BY n.name
                ),
                '{}'::types.q_get_profile_context_v4_provider[]
            ) as providers
        FROM selected_settings ss
        JOIN setting_providers sp ON sp.settings_id = ss.settings_id AND sp.active = true
        JOIN providers_resource p ON p.id = sp.providers_id
        JOIN provider_artifact pr ON pr.id = p.provider_id
        JOIN provider_names pn ON pn.provider_id = pr.id
        JOIN names_resource n ON n.id = pn.name_id
    ),
    settings_default_guest_data AS (
        -- Get default guest account: try selected settings first, fall back to default settings
        SELECT 
            COALESCE(
                (SELECT dar.profile_id::text
                 FROM selected_settings ss
                 JOIN setting_default_accounts sda ON sda.setting_id = ss.settings_id AND sda.active = true
                 JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                 WHERE dar.type = 'guest'::default_account_type AND dar.active = true
                 LIMIT 1),
                (SELECT dar.profile_id::text
                 FROM default_settings ds
                 JOIN setting_default_accounts sda ON sda.setting_id = ds.settings_id AND sda.active = true
                 JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                 WHERE dar.type = 'guest'::default_account_type AND dar.active = true
                 LIMIT 1)
            ) as default_guest_profile_id
    ),
    settings_default_account_data AS (
        -- Get default account: try selected settings first, fall back to default settings
        SELECT 
            COALESCE(
                (SELECT dar.profile_id::text
                 FROM selected_settings ss
                 JOIN setting_default_accounts sda ON sda.setting_id = ss.settings_id AND sda.active = true
                 JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                 WHERE dar.type = 'admin'::default_account_type AND dar.active = true
                 LIMIT 1),
                (SELECT dar.profile_id::text
                 FROM default_settings ds
                 JOIN setting_default_accounts sda ON sda.setting_id = ds.settings_id AND sda.active = true
                 JOIN default_accounts_resource dar ON dar.id = sda.default_account_id
                 WHERE dar.type = 'admin'::default_account_type AND dar.active = true
                 LIMIT 1)
            ) as default_account_profile_id
    )
    SELECT 
        s.id::text as settings_id,
        s.created_at as settings_created_at,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'active' AND sf.value = TRUE) as settings_active,
        (SELECT n.name FROM setting_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = s.id LIMIT 1) as settings_name,
        (SELECT d.description FROM setting_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = s.id LIMIT 1) as settings_description,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'primary'::type_setting_colors LIMIT 1) as primary_color,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'accent'::type_setting_colors LIMIT 1) as accent,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'background'::type_setting_colors LIMIT 1) as background,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'surface'::type_setting_colors LIMIT 1) as surface,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'success'::type_setting_colors LIMIT 1) as success,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'warning'::type_setting_colors LIMIT 1) as warning,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'error'::type_setting_colors LIMIT 1) as error,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_background'::type_setting_colors LIMIT 1) as sidebar_background,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'sidebar_primary'::type_setting_colors LIMIT 1) as sidebar_primary,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart1'::type_setting_colors LIMIT 1) as chart1,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart2'::type_setting_colors LIMIT 1) as chart2,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart3'::type_setting_colors LIMIT 1) as chart3,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart4'::type_setting_colors LIMIT 1) as chart4,
        (SELECT c.hex_code FROM setting_colors sc JOIN colors_resource c ON sc.color_id = c.id WHERE sc.setting_id = s.id AND sc.type = 'chart5'::type_setting_colors LIMIT 1) as chart5,
        EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'guest_login_enabled' AND sf.value = TRUE) as settings_guest_login_enabled,
        (SELECT t.value FROM setting_thresholds st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'success'::type_setting_thresholds LIMIT 1) as success_threshold,
        (SELECT t.value FROM setting_thresholds st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'warning'::type_setting_thresholds LIMIT 1) as warning_threshold,
        (SELECT t.value FROM setting_thresholds st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'danger'::type_setting_thresholds LIMIT 1) as danger_threshold,
        COALESCE(sad.auth_ids, ARRAY[]::text[]) as settings_auth_ids,
        COALESCE(sad.auths, '{}'::types.q_get_profile_context_v4_auth[]) as settings_auths,
        COALESCE(spd.provider_ids, ARRAY[]::text[]) as settings_provider_ids,
        COALESCE(spd.providers, '{}'::types.q_get_profile_context_v4_provider[]) as settings_providers,
        sdgd.default_guest_profile_id,
        sdad.default_account_profile_id
    FROM selected_settings ss
    JOIN setting_artifact s ON s.id = ss.settings_id::uuid
    LEFT JOIN settings_auths_data sad ON true
    LEFT JOIN settings_providers_data spd ON true
    LEFT JOIN settings_default_guest_data sdgd ON true
    LEFT JOIN settings_default_account_data sdad ON true
    LIMIT 1
),
actor_name_computed AS (
    -- Compute actor_name from effective_profile_id if available, else actual_profile_id
    -- This is used for audit logging
    -- Return NULL when both profile IDs are NULL (for settings-only requests)
    SELECT 
        COALESCE(
            (SELECT COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '')
             FROM profile_artifact p
             WHERE p.id = (SELECT effective_profile_id FROM resolved_profile_ids) LIMIT 1),
            (SELECT COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '')
             FROM profile_artifact p
             WHERE p.id = (SELECT actual_profile_id FROM resolved_profile_ids) LIMIT 1),
            NULL::text
        ) as actor_name
),
available_sections_computed AS (
    -- Compute available sections based on effective profile's role
    -- Returns top-level sections only - sidebar will show all subsections when parent section is available
    -- Return empty array when role is NULL (for settings-only requests)
    SELECT 
        CASE 
            WHEN epr.role IS NULL THEN ARRAY[]::text[]
            WHEN epr.role = 'superadmin'::profile_role THEN ARRAY['home', 'leaderboard', 'practice', 'analytics', 'create', 'management', 'engine', 'system', 'health', 'benchmark', 'settings']::text[]
            WHEN epr.role = 'admin'::profile_role THEN ARRAY['home', 'leaderboard', 'practice', 'analytics', 'create', 'management', 'engine', 'settings']::text[]
            WHEN epr.role = 'instructional'::profile_role THEN ARRAY['home', 'leaderboard', 'practice', 'analytics', 'create']::text[]
            WHEN epr.role = 'member'::profile_role THEN ARRAY['home', 'leaderboard', 'practice']::text[]
            ELSE ARRAY['practice']::text[]  -- guest
        END as available_sections
    FROM effective_profile_role epr
),
redirect_path_computed AS (
    -- Compute redirect path based on effective profile's role
    -- Replicates get_redirect_path_for_role logic
    -- Return NULL when role is NULL (for settings-only requests)
    SELECT 
        CASE 
            WHEN epr.role IS NULL THEN NULL::text
            WHEN epr.role = 'guest'::profile_role THEN '/practice'::text
            WHEN epr.role = 'member'::profile_role THEN '/home'::text
            WHEN epr.role = 'instructional'::profile_role THEN '/analytics/dashboard'::text
            WHEN epr.role = 'admin'::profile_role THEN '/analytics/dashboard'::text
            WHEN epr.role = 'superadmin'::profile_role THEN '/analytics/dashboard'::text
            ELSE '/home'::text
        END as redirect_path
    FROM effective_profile_role epr
),
department_ids_computed AS (
    -- Extract department IDs from dept_data
    SELECT 
        COALESCE(
            ARRAY_AGG(d.id::text ORDER BY d.is_primary DESC, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)),
            ARRAY[]::text[]
        ) as department_ids
    FROM dept_data d
),
cohort_ids_computed AS (
    -- Extract cohort IDs from cohort_data
    SELECT 
        COALESCE(
            ARRAY_AGG(c.id::text ORDER BY (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)),
            ARRAY[]::text[]
        ) as cohort_ids
    FROM cohort_data c
),
simulation_ids_computed AS (
    -- Extract simulation IDs from sim_data
    SELECT 
        COALESCE(
            ARRAY_AGG(s.id::text ORDER BY (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)),
            ARRAY[]::text[]
        ) as simulation_ids
    FROM sim_data s
),
drafts_data AS (
    -- Get all drafts for effective profile
    -- Draft data is now stored in draft_* junction tables, not in payload
    SELECT 
        d.id,
        d.artifact::text as artifact_type,
        NULL::jsonb as payload,
        d.version,
        d.updated_at
    FROM drafts d
    WHERE d.profile_id = (SELECT effective_profile_id FROM resolved_profile_ids)
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
)
SELECT 
    -- Emulation authorization flag
    ev.is_authorized::boolean as is_authorized,
    -- Authorization check fields (for default-account and guest login validation)
    (SELECT guest_login_enabled FROM selected_settings_for_auth) as guest_login_enabled,
    (SELECT count FROM active_departments_count) as active_departments_count,
    COALESCE((SELECT count FROM department_auth_providers_count), 0) as department_auth_providers_count,
    COALESCE((SELECT count FROM default_settings_auth_providers_count), 0) as default_settings_auth_providers_count,
    COALESCE((SELECT count FROM departments_without_auth_providers_count), 0) as departments_without_auth_providers_count,
    (SELECT department_exists FROM department_exists_check) as department_exists,
    -- Actual profile fields (prefixed with actual_)
    apd.id as actual_id,
    apd.first_name as actual_first_name,
    apd.last_name as actual_last_name,
    COALESCE(apd.emails, ARRAY[]::text[]) as actual_emails,
    apd.primary_email as actual_primary_email,
    apd.role as actual_role,
    apd.active as actual_active,
    apd.req_per_day as actual_req_per_day,
    apd.last_login as actual_last_login,
    apd.last_active as actual_last_active,
    apd.created_at as actual_created_at,
    apd.updated_at as actual_updated_at,
    apd.primary_department_id as actual_primary_department_id,
    -- Effective profile fields (unprefixed)
    epd.id,
    epd.first_name,
    epd.last_name,
    COALESCE(epd.emails, ARRAY[]::text[]) as emails,
    epd.primary_email,
    epd.role,
    epd.active,
    epd.req_per_day,
    epd.last_login,
    epd.last_active,
    epd.created_at,
    epd.updated_at,
    epd.primary_department_id,
    -- Context data (based on effective profile) - using composite types
    da.departments as departments,
    ca.cohorts as cohorts,
    sa.simulations as simulations,
    (SELECT earliest FROM earliest_attempt) as earliest_attempt_date,
    (SELECT scoped_roles FROM scoped_roles_computed) as scoped_roles,
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
    sr.settings_provider_ids as settings_provider_ids,
    sr.settings_providers as settings_providers,
    sr.default_guest_profile_id as settings_default_guest_profile_id,
    sr.default_account_profile_id as settings_default_account_profile_id,
    -- Computed fields
    (SELECT available_sections FROM available_sections_computed) as available_sections,
    (SELECT redirect_path FROM redirect_path_computed) as redirect_path,
    (SELECT department_ids FROM department_ids_computed) as department_ids,
    (SELECT cohort_ids FROM cohort_ids_computed) as cohort_ids,
    (SELECT simulation_ids FROM simulation_ids_computed) as simulation_ids,
    (SELECT drafts FROM drafts_aggregated) as drafts,
    -- Return empty theme tokens struct for type introspection (Python will override with computed values)
    -- 37 fields: background, foreground, card, card_foreground, popover, popover_foreground, primary_color, primary_foreground, secondary, secondary_foreground, muted, muted_foreground, accent, accent_foreground, destructive, border, input, ring, success, success_foreground, warning, warning_foreground, info, info_foreground, chart1, chart2, chart3, chart4, chart5, sidebar, sidebar_foreground, sidebar_primary, sidebar_primary_foreground, sidebar_accent, sidebar_accent_foreground, sidebar_border, sidebar_ring
    ('', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '')::types.q_get_profile_context_v4_theme_tokens as settings_tokens,
    (SELECT actor_name FROM actor_name_computed) as actor_name
FROM params
CROSS JOIN emulation_validation ev
CROSS JOIN resolved_profile_ids rpi
CROSS JOIN actual_profile_data apd
CROSS JOIN effective_profile_data epd
CROSS JOIN scoped_roles_computed src
CROSS JOIN settings_resolution sr
CROSS JOIN departments_aggregated da
CROSS JOIN cohorts_aggregated ca
CROSS JOIN simulations_aggregated sa
CROSS JOIN actor_name_computed anc
CROSS JOIN available_sections_computed asc_computed
CROSS JOIN redirect_path_computed rpc
CROSS JOIN department_ids_computed dic
CROSS JOIN cohort_ids_computed cic
CROSS JOIN simulation_ids_computed sic
CROSS JOIN drafts_aggregated da_drafts
WHERE (
    -- Standard case: require authorization and profile IDs
    (ev.is_authorized = true 
     AND rpi.actual_profile_id IS NOT NULL 
     AND rpi.effective_profile_id IS NOT NULL)
    OR
    -- Settings-only case: allow NULL profile IDs when department_id is provided (for login page theme)
    (rpi.actual_profile_id IS NULL 
     AND rpi.effective_profile_id IS NULL
     AND params.department_id IS NOT NULL
     AND params.department_id != '')
     -- Note: settings_id check happens in Python code, not here
)
$$;