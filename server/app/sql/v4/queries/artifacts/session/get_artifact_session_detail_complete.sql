-- Get session detail for artifact endpoint
-- Returns session info with paginated audits and groups from MV
--
-- Parameters:
--   p_session_id: The session to fetch
--   p_profile_id: The requesting profile (for actor name)
--   p_audit_limit: Number of audits per page
--   p_audit_offset: Audit pagination offset

-- Drop existing function
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_artifact_session_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_artifact_session_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop existing types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_artifact_session_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite types
CREATE TYPE types.q_get_artifact_session_detail_v4_audit AS (
    id uuid,
    created_at timestamptz,
    message text,
    endpoint text,
    error boolean
);

CREATE TYPE types.q_get_artifact_session_detail_v4_group AS (
    group_id uuid,
    group_name text,
    trace_id text,
    first_run_at timestamptz,
    last_run_at timestamptz,
    run_count int,
    total_tokens bigint,
    total_cost numeric
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_artifact_session_detail_v4(
    p_session_id uuid,
    p_profile_id uuid,
    p_audit_limit int DEFAULT 50,
    p_audit_offset int DEFAULT 0
)
RETURNS TABLE (
    actor_name text,
    session_exists boolean,
    session_id uuid,
    profile_id uuid,
    profile_name text,
    session_created_at timestamptz,
    active boolean,
    audit_total_count int,
    audits types.q_get_artifact_session_detail_v4_audit[],
    groups types.q_get_artifact_session_detail_v4_group[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Get actor name
    actor AS (
        SELECT COALESCE(
            (SELECT n.name
             FROM profile_names_junction pn
             JOIN names_resource n ON pn.name_id = n.id
             WHERE pn.profile_id = p_profile_id
             LIMIT 1),
            'System'
        ) AS name
    ),
    -- Get session data
    session_data AS (
        SELECT
            s.id AS session_id,
            s.profile_id,
            s.created_at AS session_created_at,
            COALESCE(s.active, FALSE) AS active
        FROM sessions_entry s
        WHERE s.id = p_session_id
    ),
    -- Get profile name for the session's profile
    session_profile AS (
        SELECT n.name AS profile_name
        FROM session_data sd
        JOIN profile_names_junction pn ON pn.profile_id = sd.profile_id
        JOIN names_resource n ON pn.name_id = n.id
        LIMIT 1
    ),
    -- Get total audit count
    audit_count AS (
        SELECT COUNT(*)::int AS total_count
        FROM audits_entry a
        WHERE a.session_id = p_session_id
    ),
    -- Get paginated audits
    paginated_audits AS (
        SELECT ARRAY_AGG(
            ROW(a.id, a.created_at, a.message, a.endpoint, a.error)::types.q_get_artifact_session_detail_v4_audit
            ORDER BY a.created_at DESC
        ) AS audits
        FROM (
            SELECT id, created_at, message, endpoint, error
            FROM audits_entry
            WHERE session_id = p_session_id
            ORDER BY created_at DESC
            LIMIT p_audit_limit OFFSET p_audit_offset
        ) a
    ),
    -- Get groups from mv_pricing_group_summary
    session_groups AS (
        SELECT ARRAY_AGG(
            ROW(gs.group_id, gs.group_name, gs.trace_id, gs.first_run_at, gs.last_run_at, gs.run_count, gs.total_tokens, gs.total_cost)::types.q_get_artifact_session_detail_v4_group
            ORDER BY gs.last_run_at DESC
        ) AS groups
        FROM mv_pricing_group_summary gs
        WHERE gs.session_id = p_session_id
    )
    SELECT
        actor.name::text AS actor_name,
        (sd.session_id IS NOT NULL)::boolean AS session_exists,
        sd.session_id,
        sd.profile_id,
        sp.profile_name::text,
        sd.session_created_at,
        sd.active,
        ac.total_count AS audit_total_count,
        COALESCE(pa.audits, ARRAY[]::types.q_get_artifact_session_detail_v4_audit[]) AS audits,
        COALESCE(sg.groups, ARRAY[]::types.q_get_artifact_session_detail_v4_group[]) AS groups
    FROM actor
    CROSS JOIN audit_count ac
    CROSS JOIN paginated_audits pa
    CROSS JOIN session_groups sg
    LEFT JOIN session_data sd ON TRUE
    LEFT JOIN session_profile sp ON TRUE;
$$;
