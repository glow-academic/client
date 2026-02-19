-- Get profile context access (Pass 1 - Light Query)
-- Returns only IDs for parallel fetching in Pass 2
-- Parameters: profile_id (uuid), department_id (text)
-- Returns: Profile basic info + IDs only (no full objects)
--
-- 2-Pass Architecture:
-- Pass 1 (this query): Fast, returns IDs only
-- Pass 2 (Python): Parallel fetch of full resources using IDs

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profile_context_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_context_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_profile_context_access_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for artifact generation capability mapping
CREATE TYPE types.q_get_profile_context_access_v4_artifact_agent AS (
    artifact text,
    has_generation boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_profile_context_access_v4(
    profile_id uuid DEFAULT NULL,
    department_id text DEFAULT NULL
)
RETURNS TABLE (
    -- Authorization
    is_authorized boolean,
    -- Profile basic info
    id uuid,
    name text,
    role text,
    active boolean,
    primary_department_id uuid,
    -- IDs for parallel fetching (Pass 2)
    department_ids uuid[],
    cohort_ids uuid[],
    settings_id uuid,
    settings_agent_ids uuid[],
    draft_ids uuid[],
    -- Computed
    scoped_roles text[],
    available_sections text[],
    actor_name text,
    -- Artifact agent IDs
    artifact_agent_ids types.q_get_profile_context_access_v4_artifact_agent[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        department_id AS department_id
),
profile_data AS (
    -- Fetch the profile basic info
    SELECT
        p.id,
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) as name,
        (SELECT r.role FROM profile_roles_junction pr_j
         JOIN roles_resource r ON pr_j.role_id = r.id
         WHERE pr_j.profile_id = p.id
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE) as active,
        pd.department_id as primary_department_id
    FROM profile_artifact p
    LEFT JOIN profile_departments_junction pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
    WHERE p.id = (SELECT profile_id FROM params)
    UNION ALL
    -- Return single row with NULL values when profile ID is NULL
    SELECT
        NULL::uuid as id,
        NULL::text as name,
        NULL::profile_type as role,
        NULL::boolean as active,
        NULL::uuid as primary_department_id
    WHERE (SELECT profile_id FROM params) IS NULL
),
profile_type AS (
    SELECT role FROM profile_data LIMIT 1
),
scoped_roles_computed AS (
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
department_ids_data AS (
    -- Get department IDs for the profile
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id ORDER BY pd.is_primary DESC, pd.created_at),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM profile_departments_junction pd
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT profile_id FROM params)
      AND pd.active = true
      AND EXISTS (
          SELECT 1 FROM department_flags_junction df
          JOIN flags_resource f ON df.flag_id = f.id
          JOIN department_departments_junction ddj ON ddj.departments_id = d.id
          WHERE df.department_id = ddj.department_id
            AND f.name = 'department_active'
            AND df.value = true
      )
),
cohort_ids_internal AS (
    -- Get cohort artifact and resource IDs for the profile
    -- artifact_id is used for junction lookups (cohort_simulations_junction.cohort_id FK -> cohort_artifact)
    -- resource_id is returned for analytics (matches mv_chat_facts.cohort_id)
    -- NOTE: profile_cohorts_junction.cohort_id is a RESOURCE ID (FK -> cohorts_resource.id)
    --   so we join via cohort_cohorts_junction.cohorts_id (resource) to get the artifact_id
    SELECT
        ccj.cohort_id AS artifact_id,
        pc.cohort_id AS resource_id,
        pc.created_at
    FROM profile_cohorts_junction pc
    JOIN cohort_cohorts_junction ccj ON ccj.cohorts_id = pc.cohort_id AND ccj.active = true
    WHERE pc.profile_id = (SELECT profile_id FROM params)
      AND pc.active = true
      AND EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = ccj.cohort_id AND f.name = 'cohort_active' AND cf.value = true)
),
cohort_ids_data AS (
    -- Return resource IDs for analytics (matches mv_chat_facts.cohort_id)
    SELECT COALESCE(
        ARRAY_AGG(resource_id ORDER BY created_at),
        ARRAY[]::uuid[]
    ) as cohort_ids
    FROM cohort_ids_internal
),
settings_resolution AS (
    -- Resolve settings based on profile's department OR department_id parameter
    WITH default_settings AS (
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
        SELECT pd.department_id
        FROM params p
        JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id
        WHERE p.profile_id IS NOT NULL
          AND pd.is_primary = TRUE
          AND pd.active = true
        LIMIT 1
    ),
    resolved_department_id AS (
        SELECT COALESCE(
            (SELECT department_id FROM profile_department),
            (SELECT CASE
                WHEN department_id IS NOT NULL AND department_id != '' THEN department_id::uuid
                ELSE NULL::uuid
            END FROM params)
        ) as department_id
    ),
    dept_specific_settings AS (
        SELECT s.id as settings_id
        FROM setting_artifact s
        JOIN department_settings_junction sd ON sd.settings_id = s.id
        CROSS JOIN resolved_department_id rdi
        WHERE rdi.department_id IS NOT NULL
          AND sd.department_id = rdi.department_id
          AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
          AND sd.active = true
        LIMIT 1
    )
    SELECT COALESCE(
        (SELECT settings_id FROM dept_specific_settings),
        (SELECT settings_id FROM default_settings),
        (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)
    ) as settings_id
),
draft_ids_data AS (
    -- Get draft IDs for the profile
    -- Must join through profile_profiles_junction to translate profile_id -> profiles_id
    SELECT COALESCE(
        ARRAY_AGG(d.id ORDER BY d.updated_at DESC),
        ARRAY[]::uuid[]
    ) as draft_ids
    FROM profile_profiles_junction ppj
    JOIN profile_drafts_profiles_connection pdc ON pdc.profiles_id = ppj.profiles_id
    JOIN (SELECT id, group_id, created_at, updated_at, active FROM agent_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM auth_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM cohort_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM department_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM document_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM eval_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM field_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM model_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM parameter_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM persona_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM profile_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM provider_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM rubric_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM scenario_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM setting_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM simulation_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM suite_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM tool_drafts_entry
     UNION ALL SELECT id, group_id, created_at, updated_at, active FROM training_drafts_entry) d ON d.id = pdc.draft_id
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
),
settings_agent_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(sj.agents_id ORDER BY sj.created_at),
        ARRAY[]::uuid[]
    ) as settings_agent_ids
    FROM setting_agents_junction sj
    WHERE sj.setting_id = (SELECT settings_id FROM settings_resolution)
      AND sj.active = true
),
artifact_agent_ids_data AS (
    -- Check which artifacts have at least one qualifying agent via two paths:
    -- 1. Direct: artifact -> artifact_resources_relation -> tool resources
    -- 2. Bindings: artifact -> artifact_view_relation -> view_entry_relation -> tool_bindings_junction

    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id
        FROM agent_artifact a
        CROSS JOIN department_ids_data did
        WHERE EXISTS (
            SELECT 1 FROM agent_flags_junction af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = a.id
              AND f.name = 'agent_active'
              AND af.value = true
        )
        AND (
            NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                WHERE ad.agent_id = a.id
                  AND ad.active = true
                  AND ad.department_id = ANY(did.department_ids)
            )
        )
    ),
    artifacts_with_agents AS (
        -- Path 1: artifact has an eligible agent whose tools cover ALL required resources
        SELECT DISTINCT arr.artifact::text as artifact
        FROM artifact_resources_relation arr
        WHERE EXISTS (
            SELECT 1 FROM eligible_agents ea
            WHERE NOT EXISTS (
                -- Check that agent has ALL required resources for this artifact
                SELECT arr2.resource
                FROM artifact_resources_relation arr2
                WHERE arr2.artifact = arr.artifact
                EXCEPT
                SELECT rt.resource
                FROM agent_tools_junction at
                JOIN tool_tools_junction ttj ON ttj.tools_id = at.tool_id
                JOIN resource_tools_relation rt ON rt.tool_id = ttj.tool_id AND rt.active = true
                WHERE at.agent_id = ea.agent_id AND at.active = true
            )
        )
        UNION
        -- Path 2: artifact has an eligible agent whose tools have ANY matching binding entries
        SELECT DISTINCT avr.artifact::text as artifact
        FROM artifact_view_relation avr
        JOIN view_entry_relation ver ON ver.view = avr.view
        JOIN bindings_resource br ON br.entry = ver.entry AND br.active = true
        WHERE EXISTS (
            SELECT 1 FROM tool_bindings_junction tbj
            WHERE tbj.binding_id = br.id AND tbj.active = true
        )
        AND EXISTS (
            SELECT 1 FROM eligible_agents ea
            JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
            JOIN tool_tools_junction ttj ON ttj.tools_id = at.tool_id
            JOIN tool_bindings_junction tbj ON tbj.tool_id = ttj.tool_id AND tbj.active = true
            JOIN bindings_resource br2 ON br2.id = tbj.binding_id AND br2.active = true
            WHERE br2.entry = ver.entry
        )
    )
    SELECT COALESCE(
        ARRAY_AGG(
            (awa.artifact, true)::types.q_get_profile_context_access_v4_artifact_agent
            ORDER BY awa.artifact
        ),
        ARRAY[]::types.q_get_profile_context_access_v4_artifact_agent[]
    ) as artifact_agent_ids
    FROM artifacts_with_agents awa
),
actor_name_computed AS (
    SELECT
        (SELECT COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '')
         FROM profile_artifact p
         WHERE p.id = (SELECT profile_id FROM params) LIMIT 1) as actor_name
)
SELECT
    -- Authorization
    (pd.id IS NOT NULL)::boolean as is_authorized,
    -- Profile basic info
    pd.id,
    pd.name,
    pd.role::text,
    pd.active,
    pd.primary_department_id,
    -- IDs for parallel fetching
    (SELECT department_ids FROM department_ids_data) as department_ids,
    (SELECT cohort_ids FROM cohort_ids_data) as cohort_ids,
    (SELECT settings_id FROM settings_resolution) as settings_id,
    (SELECT settings_agent_ids FROM settings_agent_ids_data) as settings_agent_ids,
    (SELECT draft_ids FROM draft_ids_data) as draft_ids,
    -- Computed
    (SELECT scoped_roles FROM scoped_roles_computed) as scoped_roles,
    ARRAY[]::text[] as available_sections,
    (SELECT actor_name FROM actor_name_computed) as actor_name,
    -- Artifact agent IDs
    (SELECT artifact_agent_ids FROM artifact_agent_ids_data) as artifact_agent_ids
FROM params
CROSS JOIN profile_data pd
WHERE (
    (params.profile_id IS NOT NULL AND pd.id IS NOT NULL)
    OR
    (params.profile_id IS NULL AND params.department_id IS NOT NULL AND params.department_id != '')
);
$$;
