-- Profile ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    -- Drop the type if it exists (CASCADE will drop dependent functions)
    DROP TYPE IF EXISTS profile_candidate_agent CASCADE;

    -- Recreate with fields for create/link tool IDs
    CREATE TYPE profile_candidate_agent AS (
        agent_id uuid,
        agent_name text,
        tool_resources text[],
        create_tool_ids uuid[],
        link_tool_ids uuid[],
        department_ids uuid[],
        updated_at timestamptz,
        is_mcp boolean
    );
END $$;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profile_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_profile_ids_v4(
    profile_id uuid,
    target_profile_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or profile junction)
    name_id uuid,
    request_limit_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    email_ids uuid[],
    department_ids uuid[],
    cohort_ids uuid[],

    -- Role (from draft or junction)
    role text,

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents profile_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    emails_has_tools boolean,
    request_limits_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    cohorts_has_tools boolean,

    -- Domain IDs (for domain-based generation)
    name_domain_id uuid,
    emails_domain_id uuid,
    request_limits_domain_id uuid,
    flag_domain_id uuid,
    departments_domain_id uuid,
    cohorts_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        target_profile_id AS target_profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select resource IDs
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dn.names_id FROM names_drafts_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM profile_names_junction pn WHERE pn.profile_id = (SELECT target_profile_id FROM params) LIMIT 1),
            NULL::uuid
        ) as name_id
    FROM params
),
request_limit_resource_data AS (
    SELECT
        COALESCE(
            (SELECT drl.request_limits_id
             FROM request_limits_drafts_connection drl
             WHERE drl.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT prl.request_limit_id
             FROM profile_request_limits_junction prl
             WHERE prl.profile_id = (SELECT target_profile_id FROM params)
               AND prl.active = true
             ORDER BY prl.created_at DESC
             LIMIT 1),
            NULL::uuid
        ) as request_limit_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id
             FROM flags_drafts_connection df
             WHERE df.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT pf.flag_id
             FROM profile_flags_junction pf
             JOIN flags_resource f ON pf.flag_id = f.id
             WHERE pf.profile_id = (SELECT target_profile_id FROM params)
               AND f.name = 'profile_active'
               AND pf.value = true
             LIMIT 1),
            NULL::uuid
        ) as active_flag_id
    FROM params
),
-- Multi-select resource IDs
email_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(de.emails_id ORDER BY de.created_at)
             FROM emails_drafts_connection de
             WHERE de.draft_id = (SELECT draft_id FROM params)
               AND de.active = true),
            (SELECT ARRAY_AGG(pe.email_id ORDER BY pe.is_primary DESC, pe.created_at)
             FROM profile_emails_junction pe
             WHERE pe.profile_id = (SELECT target_profile_id FROM params)
               AND pe.active = true),
            ARRAY[]::uuid[]
        ) as email_ids
    FROM params
    LIMIT 1
),
department_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
             FROM departments_drafts_connection dd
             WHERE dd.draft_id = (SELECT draft_id FROM params)
               AND dd.active = true),
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
             FROM profile_departments_junction pd
             WHERE pd.profile_id = (SELECT target_profile_id FROM params)
               AND pd.active = true),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM params
    LIMIT 1
),
cohort_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(dc.cohorts_id ORDER BY dc.created_at)
             FROM cohorts_drafts_connection dc
             WHERE dc.draft_id = (SELECT draft_id FROM params)
               AND dc.active = true),
            (SELECT ARRAY_AGG(pc.cohort_id ORDER BY pc.created_at)
             FROM profile_cohorts_junction pc
             WHERE pc.profile_id = (SELECT target_profile_id FROM params)
               AND pc.active = true),
            ARRAY[]::uuid[]
        ) as cohort_ids
    FROM params
    LIMIT 1
),
-- Role (from draft or junction)
target_role_data AS (
    SELECT
        COALESCE(
            (
                SELECT r.role::text
                FROM roles_drafts_connection dr
                JOIN roles_resource r ON dr.roles_id = r.id
                WHERE dr.draft_id = (SELECT draft_id FROM params)
                  AND dr.active = true
                LIMIT 1
            ),
            CASE
                WHEN (SELECT target_profile_id FROM params) IS NULL THEN NULL::text
                ELSE (
                    SELECT r.role::text
                    FROM profile_roles_junction pr
                    JOIN roles_resource r ON pr.role_id = r.id
                    WHERE pr.profile_id = (SELECT target_profile_id FROM params)
                      AND pr.active = true
                    LIMIT 1
                )
            END
        ) as role
    FROM params
    LIMIT 1
),
-- Candidate agents data (for Python-side agent scoring)
-- First get per-agent, per-resource tool IDs with creatable flag
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable  -- Default true if flag not set
    FROM agent_artifact a
    JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact ta ON ta.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = ta.id
    LEFT JOIN tool_flags_junction tf_active ON tf_active.tool_id = ta.id
    LEFT JOIN flags_resource f_active ON f_active.id = tf_active.flag_id AND f_active.name = 'tool_active'
    LEFT JOIN tool_flags_junction tf_create ON tf_create.tool_id = ta.id
    LEFT JOIN flags_resource f_create ON f_create.id = tf_create.flag_id AND f_create.name = 'tool_creatable'
    LEFT JOIN agent_flags_junction af_agent ON af_agent.agent_id = a.id
    LEFT JOIN flags_resource f_agent ON f_agent.id = af_agent.flag_id AND f_agent.name = 'agent_active'
    WHERE COALESCE(af_agent.value, false) = true
      AND (tf_active.tool_id IS NULL OR COALESCE(f_active.id, NULL) IS NULL OR COALESCE(tf_active.value, false) = true)
),
-- Step 1: Pick one create and one link tool per (agent, resource)
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
-- Step 2: Aggregate into aligned arrays (all same length, same order)
agent_tool_arrays AS (
    SELECT
        agent_id,
        ARRAY_AGG(resource_name ORDER BY resource_name) as tool_resources,
        ARRAY_AGG(create_tool_id ORDER BY resource_name) as create_tool_ids,
        ARRAY_AGG(link_tool_id ORDER BY resource_name) as link_tool_ids
    FROM agent_resource_tool_pairs
    GROUP BY agent_id
),
candidate_agents_data AS (
    SELECT
        a.id as agent_id,
        n.name as agent_name,
        COALESCE(ata.tool_resources, ARRAY[]::text[]) as tool_resources,
        COALESCE(ata.create_tool_ids, ARRAY[]::uuid[]) as create_tool_ids,
        COALESCE(ata.link_tool_ids, ARRAY[]::uuid[]) as link_tool_ids,
        COALESCE(ARRAY_AGG(DISTINCT ad.department_id) FILTER (WHERE ad.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids,
        a.updated_at,
        COALESCE(af_mcp.value, false) as is_mcp
    FROM agent_artifact a
    JOIN agent_names_junction anj ON anj.agent_id = a.id
    JOIN names_resource n ON n.id = anj.name_id
    LEFT JOIN agent_tool_arrays ata ON ata.agent_id = a.id
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN agent_flags_junction af_active ON af_active.agent_id = a.id
    LEFT JOIN flags_resource f_active ON f_active.id = af_active.flag_id AND f_active.name = 'agent_active'
    LEFT JOIN agent_flags_junction af_mcp ON af_mcp.agent_id = a.id
    LEFT JOIN flags_resource f_mcp ON f_mcp.id = af_mcp.flag_id AND f_mcp.name = 'mcp'
    WHERE COALESCE(af_active.value, false) = true
      AND (
          NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
          OR EXISTS (SELECT 1 FROM agent_departments_junction ad3 WHERE ad3.agent_id = a.id AND ad3.active = true AND ad3.department_id = ANY(user_department_ids))
      )
    GROUP BY a.id, n.name, a.updated_at, af_mcp.value, ata.tool_resources, ata.create_tool_ids, ata.link_tool_ids
),
-- Tools existence check
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'emails'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as emails_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'request_limits'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as request_limits_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'cohorts'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as cohorts_has_tools
    FROM params x
),
-- Domain IDs from domains_resource table
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'emails'::resource_type AND active = true LIMIT 1) as emails_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'request_limits'::resource_type AND active = true LIMIT 1) as request_limits_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'cohorts'::resource_type AND active = true LIMIT 1) as cohorts_domain_id
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT request_limit_id FROM request_limit_resource_data) as request_limit_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT email_ids FROM email_ids_data) as email_ids,
    (SELECT department_ids FROM department_ids_data) as department_ids,
    (SELECT cohort_ids FROM cohort_ids_data) as cohort_ids,

    -- Role
    (SELECT role FROM target_role_data) as role,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::profile_candidate_agent),
        ARRAY[]::profile_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.emails_has_tools,
    tec.request_limits_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.cohorts_has_tools,

    -- Domain IDs
    did.name_domain_id,
    did.emails_domain_id,
    did.request_limits_domain_id,
    did.flag_domain_id,
    did.departments_domain_id,
    did.cohorts_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
