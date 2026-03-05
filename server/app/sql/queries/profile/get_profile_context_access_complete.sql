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
    department_id text DEFAULT NULL,
    p_artifact_entries jsonb DEFAULT '{}'::jsonb
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
    settings_system_ids uuid[],
    settings_agent_ids uuid[],
    draft_ids uuid[],
    -- Computed
    scoped_roles text[],
    available_sections text[],
    artifacts text[],
    actor_name text,
    -- Profiles resource ID
    profiles_id uuid,
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
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1) as name,
        (SELECT r.role FROM profile_roles_junction pr_j
         JOIN roles_resource r ON pr_j.roles_id = r.id
         WHERE pr_j.profile_id = p.id
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND f.value = TRUE) as active,
        pd.departments_id as primary_department_id,
        (SELECT r.artifacts FROM profile_roles_junction pr_j
         JOIN roles_resource r ON pr_j.roles_id = r.id
         WHERE pr_j.profile_id = p.id LIMIT 1) as artifacts
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
        NULL::uuid as primary_department_id,
        NULL::artifact_type[] as artifacts
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
        ARRAY_AGG(pd.departments_id ORDER BY pd.is_primary DESC, pd.created_at),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM profile_departments_junction pd
    JOIN departments_resource d ON d.id = pd.departments_id
    WHERE pd.profile_id = (SELECT profile_id FROM params)
      AND pd.active = true
      AND EXISTS (
          SELECT 1 FROM department_flags_junction df
          JOIN flags_resource f ON df.flags_id = f.id
          JOIN department_departments_junction ddj ON ddj.department_id = d.id
          WHERE df.department_id = ddj.department_id
            AND f.name = 'department_active'
            AND f.value = true
      )
),
cohort_ids_internal AS (
    -- Get cohort artifact and resource IDs for the profile via REVERSE junction
    -- Goes through profile_profiles_junction -> cohort_profiles_junction (reverse)
    -- Then joins cohort_cohorts_junction for resource IDs (analytics)
    SELECT
        cpj.cohort_id AS artifacts_id,
        ccj.cohorts_id AS resources_id,
        cpj.created_at
    FROM profile_profiles_junction ppj
    JOIN cohort_profiles_junction cpj ON cpj.profiles_id = ppj.profile_id AND cpj.active = true
    JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = cpj.cohort_id AND ccj.active = true
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
      AND EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flags_id = f.id WHERE cf.cohort_id = cpj.cohort_id AND f.name = 'cohort_active' AND f.value = true)
),
cohort_ids_data AS (
    -- Return resource IDs for analytics (matches mv_chat_facts.cohort_id)
    SELECT COALESCE(
        ARRAY_AGG(resources_id ORDER BY created_at),
        ARRAY[]::uuid[]
    ) as cohort_ids
    FROM cohort_ids_internal
),
settings_resolution AS (
    -- Resolve settings based on profile's department OR department_id parameter
    WITH default_settings AS (
        SELECT s.id as settings_id
        FROM setting_artifact s
        WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flags_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND f.value = TRUE)
          AND NOT EXISTS (
              SELECT 1 FROM department_settings_junction sd
              WHERE sd.settings_id = s.id AND sd.active = true
          )
        LIMIT 1
    ),
    profile_department AS (
        SELECT pd.departments_id
        FROM params p
        JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id
        WHERE p.profile_id IS NOT NULL
          AND pd.is_primary = TRUE
          AND pd.active = true
        LIMIT 1
    ),
    resolved_department_id AS (
        SELECT COALESCE(
            (SELECT departments_id FROM profile_department),
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
          AND EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flags_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND f.value = TRUE)
          AND sd.active = true
        LIMIT 1
    )
    SELECT COALESCE(
        (SELECT settings_id FROM dept_specific_settings),
        (SELECT settings_id FROM default_settings),
        (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags_junction sf JOIN flags_resource f ON sf.flags_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND f.value = TRUE) LIMIT 1)
    ) as settings_id
),
draft_ids_data AS (
    -- Get draft IDs for the profile
    -- Must join through profile_profiles_junction to translate profile_id -> profiles_id
    SELECT COALESCE(
        ARRAY_AGG(d.id ORDER BY d.created_at DESC),
        ARRAY[]::uuid[]
    ) as draft_ids
    FROM profile_profiles_junction ppj
    JOIN profiles_sessions_connection psc ON psc.profiles_id = ppj.profile_id
    JOIN (SELECT id, session_id, created_at, active FROM agent_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM auth_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM cohort_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM department_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM document_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM eval_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM field_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM model_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM parameter_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM persona_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM profile_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM provider_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM rubric_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM scenario_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM setting_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM simulation_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM invocation_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM tool_drafts_entry
     UNION ALL SELECT id, session_id, created_at, active FROM chat_drafts_entry) d ON d.session_id = psc.session_id
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
      AND d.active = true
),
settings_agent_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT src.agent_id),
        ARRAY[]::uuid[]
    ) as settings_agent_ids
    FROM (
        -- setting -> systems -> agents links (unnest agent_ids array)
        SELECT unnest(sr.agent_ids) AS agent_id
        FROM setting_systems_junction ssj
        JOIN systems_resource sr ON sr.id = ssj.systems_id
        WHERE ssj.setting_id = (SELECT settings_id FROM settings_resolution)
          AND ssj.active = true
    ) src
),
settings_system_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT ssj.systems_id),
        ARRAY[]::uuid[]
    ) as settings_system_ids
    FROM setting_systems_junction ssj
    WHERE ssj.setting_id = (SELECT settings_id FROM settings_resolution)
      AND ssj.active = true
),
artifact_agent_ids_data AS (
    -- Check which artifacts have at least one qualifying agent via two paths:
    -- 1. Direct: artifact -> inline resource map -> tool resources
    -- 2. Bindings: artifact -> entries -> tool_entries_junction

    WITH artifact_resource_map AS (
        SELECT artifact, resource
        FROM (VALUES
            ('agent'::artifact_type, 'departments'::resource_type),
            ('agent'::artifact_type, 'descriptions'::resource_type),
            ('agent'::artifact_type, 'flags'::resource_type),
            ('agent'::artifact_type, 'instructions'::resource_type),
            ('agent'::artifact_type, 'models'::resource_type),
            ('agent'::artifact_type, 'names'::resource_type),
            ('agent'::artifact_type, 'prompts'::resource_type),
            ('agent'::artifact_type, 'reasoning_levels'::resource_type),
            ('agent'::artifact_type, 'temperature_levels'::resource_type),
            ('agent'::artifact_type, 'tools'::resource_type),
            ('agent'::artifact_type, 'voices'::resource_type),
            ('auth'::artifact_type, 'departments'::resource_type),
            ('auth'::artifact_type, 'descriptions'::resource_type),
            ('auth'::artifact_type, 'flags'::resource_type),
            ('auth'::artifact_type, 'items'::resource_type),
            ('auth'::artifact_type, 'names'::resource_type),
            ('auth'::artifact_type, 'protocols'::resource_type),
            ('auth'::artifact_type, 'slugs'::resource_type),
            ('cohort'::artifact_type, 'departments'::resource_type),
            ('cohort'::artifact_type, 'descriptions'::resource_type),
            ('cohort'::artifact_type, 'flags'::resource_type),
            ('cohort'::artifact_type, 'names'::resource_type),
            ('cohort'::artifact_type, 'simulation_positions'::resource_type),
            ('cohort'::artifact_type, 'simulations'::resource_type),
            ('department'::artifact_type, 'descriptions'::resource_type),
            ('department'::artifact_type, 'flags'::resource_type),
            ('department'::artifact_type, 'names'::resource_type),
            ('department'::artifact_type, 'settings'::resource_type),
            ('document'::artifact_type, 'departments'::resource_type),
            ('document'::artifact_type, 'descriptions'::resource_type),
            ('document'::artifact_type, 'flags'::resource_type),
            ('document'::artifact_type, 'names'::resource_type),
            ('document'::artifact_type, 'parameter_fields'::resource_type),
            ('document'::artifact_type, 'parameters'::resource_type),
            ('eval'::artifact_type, 'departments'::resource_type),
            ('eval'::artifact_type, 'descriptions'::resource_type),
            ('eval'::artifact_type, 'flags'::resource_type),
            ('eval'::artifact_type, 'group_positions'::resource_type),
            ('eval'::artifact_type, 'groups'::resource_type),
            ('eval'::artifact_type, 'names'::resource_type),
            ('eval'::artifact_type, 'run_positions'::resource_type),
            ('eval'::artifact_type, 'runs'::resource_type),
            ('field'::artifact_type, 'conditional_parameters'::resource_type),
            ('field'::artifact_type, 'departments'::resource_type),
            ('field'::artifact_type, 'descriptions'::resource_type),
            ('field'::artifact_type, 'flags'::resource_type),
            ('field'::artifact_type, 'names'::resource_type),
            ('model'::artifact_type, 'departments'::resource_type),
            ('model'::artifact_type, 'descriptions'::resource_type),
            ('model'::artifact_type, 'flags'::resource_type),
            ('model'::artifact_type, 'modalities'::resource_type),
            ('model'::artifact_type, 'names'::resource_type),
            ('model'::artifact_type, 'pricing'::resource_type),
            ('model'::artifact_type, 'providers'::resource_type),
            ('model'::artifact_type, 'qualities'::resource_type),
            ('model'::artifact_type, 'reasoning_levels'::resource_type),
            ('model'::artifact_type, 'temperature_levels'::resource_type),
            ('model'::artifact_type, 'values'::resource_type),
            ('model'::artifact_type, 'voices'::resource_type),
            ('parameter'::artifact_type, 'departments'::resource_type),
            ('parameter'::artifact_type, 'descriptions'::resource_type),
            ('parameter'::artifact_type, 'fields'::resource_type),
            ('parameter'::artifact_type, 'flags'::resource_type),
            ('parameter'::artifact_type, 'names'::resource_type),
            ('persona'::artifact_type, 'colors'::resource_type),
            ('persona'::artifact_type, 'departments'::resource_type),
            ('persona'::artifact_type, 'descriptions'::resource_type),
            ('persona'::artifact_type, 'examples'::resource_type),
            ('persona'::artifact_type, 'flags'::resource_type),
            ('persona'::artifact_type, 'icons'::resource_type),
            ('persona'::artifact_type, 'instructions'::resource_type),
            ('persona'::artifact_type, 'names'::resource_type),
            ('persona'::artifact_type, 'parameter_fields'::resource_type),
            ('persona'::artifact_type, 'parameters'::resource_type),
            ('profile'::artifact_type, 'departments'::resource_type),
            ('profile'::artifact_type, 'emails'::resource_type),
            ('profile'::artifact_type, 'flags'::resource_type),
            ('profile'::artifact_type, 'names'::resource_type),
            ('profile'::artifact_type, 'request_limits'::resource_type),
            ('profile'::artifact_type, 'roles'::resource_type),
            ('profile'::artifact_type, 'routes'::resource_type),
            ('provider'::artifact_type, 'departments'::resource_type),
            ('provider'::artifact_type, 'descriptions'::resource_type),
            ('provider'::artifact_type, 'endpoints'::resource_type),
            ('provider'::artifact_type, 'flags'::resource_type),
            ('provider'::artifact_type, 'keys'::resource_type),
            ('provider'::artifact_type, 'names'::resource_type),
            ('provider'::artifact_type, 'values'::resource_type),
            ('rubric'::artifact_type, 'departments'::resource_type),
            ('rubric'::artifact_type, 'descriptions'::resource_type),
            ('rubric'::artifact_type, 'flags'::resource_type),
            ('rubric'::artifact_type, 'names'::resource_type),
            ('rubric'::artifact_type, 'points'::resource_type),
            ('rubric'::artifact_type, 'standard_groups'::resource_type),
            ('rubric'::artifact_type, 'standards'::resource_type),
            ('scenario'::artifact_type, 'departments'::resource_type),
            ('scenario'::artifact_type, 'descriptions'::resource_type),
            ('scenario'::artifact_type, 'documents'::resource_type),
            ('scenario'::artifact_type, 'flags'::resource_type),
            ('scenario'::artifact_type, 'images'::resource_type),
            ('scenario'::artifact_type, 'names'::resource_type),
            ('scenario'::artifact_type, 'objectives'::resource_type),
            ('scenario'::artifact_type, 'options'::resource_type),
            ('scenario'::artifact_type, 'parameter_fields'::resource_type),
            ('scenario'::artifact_type, 'parameters'::resource_type),
            ('scenario'::artifact_type, 'personas'::resource_type),
            ('scenario'::artifact_type, 'problem_statements'::resource_type),
            ('scenario'::artifact_type, 'questions'::resource_type),
            ('scenario'::artifact_type, 'videos'::resource_type),
            ('setting'::artifact_type, 'agents'::resource_type),
            ('setting'::artifact_type, 'auth_item_keys'::resource_type),
            ('setting'::artifact_type, 'auths'::resource_type),
            ('setting'::artifact_type, 'colors'::resource_type),
            ('setting'::artifact_type, 'departments'::resource_type),
            ('setting'::artifact_type, 'descriptions'::resource_type),
            ('setting'::artifact_type, 'flags'::resource_type),
            ('setting'::artifact_type, 'names'::resource_type),
            ('setting'::artifact_type, 'profiles'::resource_type),
            ('setting'::artifact_type, 'provider_keys'::resource_type),
            ('setting'::artifact_type, 'role_routes'::resource_type),
            ('setting'::artifact_type, 'roles'::resource_type),
            ('setting'::artifact_type, 'thresholds'::resource_type),
            ('simulation'::artifact_type, 'departments'::resource_type),
            ('simulation'::artifact_type, 'descriptions'::resource_type),
            ('simulation'::artifact_type, 'flags'::resource_type),
            ('simulation'::artifact_type, 'names'::resource_type),
            ('simulation'::artifact_type, 'scenario_flags'::resource_type),
            ('simulation'::artifact_type, 'scenario_positions'::resource_type),
            ('simulation'::artifact_type, 'scenario_rubrics'::resource_type),
            ('simulation'::artifact_type, 'scenario_time_limits'::resource_type),
            ('simulation'::artifact_type, 'scenarios'::resource_type),
            ('tool'::artifact_type, 'arg_positions'::resource_type),
            ('tool'::artifact_type, 'args'::resource_type),
            ('tool'::artifact_type, 'args_outputs'::resource_type),
            ('tool'::artifact_type, 'bindings'::resource_type),
            ('tool'::artifact_type, 'departments'::resource_type),
            ('tool'::artifact_type, 'descriptions'::resource_type),
            ('tool'::artifact_type, 'domains'::resource_type),
            ('tool'::artifact_type, 'flags'::resource_type),
            ('tool'::artifact_type, 'names'::resource_type)
        ) AS v(artifact, resource)
    ),
    eligible_agents AS (
        SELECT DISTINCT a.id as agent_id
        FROM agent_artifact a
        CROSS JOIN department_ids_data did
        WHERE EXISTS (
            SELECT 1 FROM agent_flags_junction af
            JOIN flags_resource f ON af.flags_id = f.id
            WHERE af.agent_id = a.id
              AND f.name = 'agent_active'
              AND f.value = true
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
                  AND ad.departments_id = ANY(did.department_ids)
            )
        )
    ),
    artifacts_with_agents AS (
        -- Path 1: artifact has an eligible agent whose tools cover ALL required resources
        SELECT DISTINCT arr.artifact as artifact
        FROM artifact_resource_map arr
        WHERE EXISTS (
            SELECT 1 FROM eligible_agents ea
            WHERE NOT EXISTS (
                -- Check that agent has ALL required resources for this artifact
                SELECT arr2.resource
                FROM artifact_resource_map arr2
                WHERE arr2.artifact = arr.artifact
                EXCEPT
                SELECT dr.resource
                FROM agent_tools_junction at
                JOIN tool_tools_junction ttj ON ttj.tool_id = at.tools_id
                JOIN tool_resources_junction tdj ON tdj.tool_id = ttj.tool_id AND tdj.active = true
                JOIN resources_resource dr ON dr.id = tdj.resources_id AND dr.active = true
                WHERE at.agent_id = ea.agent_id AND at.active = true
            )
        )
        UNION
        -- Path 2: artifact has an eligible agent whose tools have ANY matching binding entries
        SELECT DISTINCT kv.key::artifact_type as artifact
        FROM jsonb_each(p_artifact_entries) AS kv(key, value)
        CROSS JOIN LATERAL jsonb_array_elements_text(kv.value) AS e(entry)
        JOIN entries_resource br ON br.entry = e.entry::entry_type AND br.active = true
        WHERE EXISTS (
            SELECT 1 FROM tool_entries_junction tbj
            WHERE tbj.entries_id = br.id AND tbj.active = true
        )
        AND EXISTS (
            SELECT 1 FROM eligible_agents ea
            JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
            JOIN tool_tools_junction ttj ON ttj.tool_id = at.tools_id
            JOIN tool_entries_junction tbj ON tbj.tool_id = ttj.tool_id AND tbj.active = true
            JOIN entries_resource br2 ON br2.id = tbj.entries_id AND br2.active = true
            WHERE br2.entry = e.entry::entry_type
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
profiles_id_data AS (
    -- Resolve profiles_resource_id from profile_profiles_junction
    SELECT ppj.profile_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
      AND ppj.active = true
    LIMIT 1
),
actor_name_computed AS (
    SELECT
        (SELECT COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '')
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
    (SELECT settings_system_ids FROM settings_system_ids_data) as settings_system_ids,
    (SELECT settings_agent_ids FROM settings_agent_ids_data) as settings_agent_ids,
    (SELECT draft_ids FROM draft_ids_data) as draft_ids,
    -- Computed
    (SELECT scoped_roles FROM scoped_roles_computed) as scoped_roles,
    ARRAY[]::text[] as available_sections,
    pd.artifacts as artifacts,
    (SELECT actor_name FROM actor_name_computed) as actor_name,
    -- Profiles resource ID
    (SELECT profile_id FROM profiles_id_data) as profiles_id,
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
