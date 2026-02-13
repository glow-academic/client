-- Setting ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    DROP TYPE IF EXISTS setting_candidate_agent CASCADE;

    CREATE TYPE setting_candidate_agent AS (
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
        WHERE proname = 'api_get_setting_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_setting_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_setting_ids_v4(
    profile_id uuid,
    setting_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    color_search text DEFAULT NULL,
    mcp boolean DEFAULT false,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (merged: draft overrides canonical)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs (merged: draft overrides canonical)
    color_ids uuid[],
    department_ids uuid[],
    profile_ids uuid[],
    auth_ids uuid[],
    provider_key_ids uuid[],
    auth_item_key_ids uuid[],
    role_ids uuid[],
    role_route_ids uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents setting_candidate_agent[],

    -- Tools existence (for Python to compute show_ai_generate flags)
    names_has_tools boolean,
    descriptions_has_tools boolean,
    colors_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    profiles_has_tools boolean,
    auths_has_tools boolean,

    -- Config chain resource IDs (for pre-fetched generation config)
    config_agent_resource_ids uuid[],
    config_model_resource_ids uuid[],
    config_provider_resource_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        setting_id AS setting_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        user_department_ids AS user_department_ids
),
-- ========== CANONICAL IDs (from setting junctions) ==========
-- Single-select
canonical_name AS (
    SELECT pn.name_id
    FROM setting_names_junction pn
    WHERE pn.setting_id = (SELECT setting_id FROM params) AND pn.active = true
    LIMIT 1
),
canonical_description AS (
    SELECT pd.description_id
    FROM setting_descriptions_junction pd
    WHERE pd.setting_id = (SELECT setting_id FROM params) AND pd.active = true
    LIMIT 1
),
canonical_flag AS (
    SELECT pf.flag_id as active_flag_id
    FROM setting_flags_junction pf
    JOIN flags_resource f ON pf.flag_id = f.id
    WHERE pf.setting_id = (SELECT setting_id FROM params)
      AND pf.active = true
      AND f.name = 'setting_active'
      AND pf.value = TRUE
    LIMIT 1
),
-- Multi-select
canonical_colors AS (
    SELECT COALESCE(
        ARRAY_AGG(sc.color_id ORDER BY sc.created_at),
        ARRAY[]::uuid[]
    ) as color_ids
    FROM setting_colors_junction sc
    WHERE sc.setting_id = (SELECT setting_id FROM params) AND sc.active = true
),
canonical_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(ds.department_id ORDER BY ds.created_at),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM department_settings_junction ds
    WHERE ds.settings_id = (SELECT setting_id FROM params) AND ds.active = true
),
canonical_profiles AS (
    SELECT COALESCE(
        ARRAY_AGG(sp.profile_id ORDER BY sp.created_at),
        ARRAY[]::uuid[]
    ) as profile_ids
    FROM setting_profiles_junction sp
    WHERE sp.setting_id = (SELECT setting_id FROM params) AND sp.active = true
),
canonical_auths AS (
    SELECT COALESCE(
        ARRAY_AGG(sa.auth_id ORDER BY sa.created_at),
        ARRAY[]::uuid[]
    ) as auth_ids
    FROM setting_auths_junction sa
    WHERE sa.settings_id = (SELECT setting_id FROM params) AND sa.active = true
),
canonical_provider_keys AS (
    SELECT COALESCE(
        ARRAY_AGG(spk.provider_key_id ORDER BY spk.created_at),
        ARRAY[]::uuid[]
    ) as provider_key_ids
    FROM setting_provider_keys_junction spk
    WHERE spk.setting_id = (SELECT setting_id FROM params) AND spk.active = true
),
canonical_auth_item_keys AS (
    SELECT COALESCE(
        ARRAY_AGG(saik.auth_item_keys_id ORDER BY saik.created_at),
        ARRAY[]::uuid[]
    ) as auth_item_key_ids
    FROM setting_auth_item_keys_junction saik
    WHERE saik.setting_id = (SELECT setting_id FROM params) AND saik.active = true
),
canonical_roles AS (
    SELECT COALESCE(
        ARRAY_AGG(sr.role_id ORDER BY sr.created_at),
        ARRAY[]::uuid[]
    ) as role_ids
    FROM setting_roles_junction sr
    WHERE sr.setting_id = (SELECT setting_id FROM params) AND sr.active = true
),
canonical_role_routes AS (
    SELECT COALESCE(
        ARRAY_AGG(srr.role_routes_id ORDER BY srr.created_at),
        ARRAY[]::uuid[]
    ) as role_route_ids
    FROM setting_role_routes_junction srr
    WHERE srr.setting_id = (SELECT setting_id FROM params) AND srr.active = true
),
-- ========== DRAFT IDs (override canonical when draft exists) ==========
draft_name AS (
    SELECT ndc.names_id as name_id
    FROM names_drafts_connection ndc
    WHERE ndc.draft_id = (SELECT draft_id FROM params)
    LIMIT 1
),
draft_description AS (
    SELECT ddc.descriptions_id as description_id
    FROM descriptions_drafts_connection ddc
    WHERE ddc.draft_id = (SELECT draft_id FROM params)
    LIMIT 1
),
draft_flag AS (
    SELECT fdc.flags_id as active_flag_id
    FROM flags_drafts_connection fdc
    WHERE fdc.draft_id = (SELECT draft_id FROM params)
    LIMIT 1
),
draft_colors AS (
    SELECT COALESCE(
        ARRAY_AGG(cdc.colors_id),
        ARRAY[]::uuid[]
    ) as color_ids
    FROM colors_drafts_connection cdc
    WHERE cdc.draft_id = (SELECT draft_id FROM params)
),
draft_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(ddc.departments_id),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM departments_drafts_connection ddc
    WHERE ddc.draft_id = (SELECT draft_id FROM params)
),
draft_profiles AS (
    SELECT COALESCE(
        ARRAY_AGG(pdc.profiles_id),
        ARRAY[]::uuid[]
    ) as profile_ids
    FROM profiles_drafts_connection pdc
    WHERE pdc.draft_id = (SELECT draft_id FROM params)
      AND pdc.profiles_id != (SELECT profile_id FROM params)  -- Exclude the owner profile
),
draft_provider_keys AS (
    SELECT COALESCE(
        ARRAY_AGG(pdc.providers_id),
        ARRAY[]::uuid[]
    ) as provider_key_ids
    FROM providers_drafts_connection pdc
    WHERE pdc.draft_id = (SELECT draft_id FROM params)
),
draft_auth_item_keys AS (
    SELECT COALESCE(
        ARRAY_AGG(kdc.keys_id),
        ARRAY[]::uuid[]
    ) as auth_item_key_ids
    FROM keys_drafts_connection kdc
    WHERE kdc.draft_id = (SELECT draft_id FROM params)
),
draft_roles AS (
    SELECT COALESCE(
        ARRAY_AGG(rdc.roles_id),
        ARRAY[]::uuid[]
    ) as role_ids
    FROM roles_drafts_connection rdc
    WHERE rdc.draft_id = (SELECT draft_id FROM params)
),
draft_role_routes AS (
    SELECT COALESCE(
        ARRAY_AGG(rrdc.role_routes_id),
        ARRAY[]::uuid[]
    ) as role_route_ids
    FROM role_routes_drafts_connection rrdc
    WHERE rrdc.draft_id = (SELECT draft_id FROM params)
),
-- ========== MERGED IDs (draft overrides canonical) ==========
merged_ids AS (
    SELECT
        -- Single-select: COALESCE draft over canonical
        COALESCE((SELECT name_id FROM draft_name), (SELECT name_id FROM canonical_name)) as name_id,
        COALESCE((SELECT description_id FROM draft_description), (SELECT description_id FROM canonical_description)) as description_id,
        COALESCE((SELECT active_flag_id FROM draft_flag), (SELECT active_flag_id FROM canonical_flag)) as active_flag_id,
        -- Multi-select: use draft if draft has entries, else canonical
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM colors_drafts_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT color_ids FROM draft_colors)
            ELSE (SELECT color_ids FROM canonical_colors)
        END as color_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM departments_drafts_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT department_ids FROM draft_departments)
            ELSE (SELECT department_ids FROM canonical_departments)
        END as department_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM profiles_drafts_connection pdc WHERE pdc.draft_id = (SELECT draft_id FROM params) AND pdc.profiles_id != (SELECT profile_id FROM params))
            THEN (SELECT profile_ids FROM draft_profiles)
            ELSE (SELECT profile_ids FROM canonical_profiles)
        END as profile_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_auths_junction WHERE settings_id = (SELECT setting_id FROM params))
            THEN (SELECT auth_ids FROM canonical_auths)
            ELSE (SELECT auth_ids FROM canonical_auths)
        END as auth_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM providers_drafts_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT provider_key_ids FROM draft_provider_keys)
            ELSE (SELECT provider_key_ids FROM canonical_provider_keys)
        END as provider_key_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM keys_drafts_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT auth_item_key_ids FROM draft_auth_item_keys)
            ELSE (SELECT auth_item_key_ids FROM canonical_auth_item_keys)
        END as auth_item_key_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM roles_drafts_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT role_ids FROM draft_roles)
            ELSE (SELECT role_ids FROM canonical_roles)
        END as role_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM role_routes_drafts_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT role_route_ids FROM draft_role_routes)
            ELSE (SELECT role_route_ids FROM canonical_role_routes)
        END as role_route_ids
),
-- ========== CANDIDATE AGENTS (for Python-side agent scoring) ==========
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable
    FROM agent_artifact a
    JOIN agent_tools_junction atj ON atj.agent_id = a.id AND atj.active = true
    JOIN tools_resource tr ON tr.id = atj.tool_id
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
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
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
-- ========== CONFIG CHAIN (departments -> settings -> agents -> models -> providers) ==========
config_settings AS (
    SELECT DISTINCT unnest(dr.setting_ids) as setting_id
    FROM departments_resource dr
    WHERE dr.id = ANY(user_department_ids)
      AND dr.active = true
      AND dr.setting_ids IS NOT NULL
      AND dr.setting_ids != ARRAY[]::uuid[]
),
config_settings_data AS (
    SELECT sr.id, sr.agent_ids
    FROM settings_resource sr
    JOIN config_settings cs ON sr.id = cs.setting_id
    WHERE sr.active = true
),
config_agent_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT agent_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM (
        SELECT unnest(csd.agent_ids) as agent_id
        FROM config_settings_data csd
        WHERE csd.agent_ids IS NOT NULL AND csd.agent_ids != ARRAY[]::uuid[]
    ) sub
),
config_model_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT ar.model_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM config_agent_resource_ids_data cari
    JOIN LATERAL unnest(cari.ids) AS agent_res_id ON true
    JOIN agents_resource ar ON ar.id = agent_res_id
    WHERE ar.model_id IS NOT NULL
),
config_provider_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT mr.provider_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM config_model_resource_ids_data cmri
    JOIN LATERAL unnest(cmri.ids) AS model_res_id ON true
    JOIN models_resource mr ON mr.id = model_res_id
    WHERE mr.provider_id IS NOT NULL
),
-- ========== TOOLS EXISTENCE CHECK ==========
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'descriptions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as descriptions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'colors'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as colors_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'profiles'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as profiles_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'auths'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as auths_has_tools
)
SELECT
    -- Single-select merged IDs
    m.name_id,
    m.description_id,
    m.active_flag_id,

    -- Multi-select merged IDs
    m.color_ids,
    m.department_ids,
    m.profile_ids,
    m.auth_ids,
    m.provider_key_ids,
    m.auth_item_key_ids,
    m.role_ids,
    m.role_route_ids,

    -- Candidate agents
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::setting_candidate_agent),
        ARRAY[]::setting_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.colors_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.profiles_has_tools,
    tec.auths_has_tools,

    -- Config chain resource IDs
    (SELECT ids FROM config_agent_resource_ids_data) as config_agent_resource_ids,
    (SELECT ids FROM config_model_resource_ids_data) as config_model_resource_ids,
    (SELECT ids FROM config_provider_resource_ids_data) as config_provider_resource_ids
FROM merged_ids m
CROSS JOIN tools_existence_check tec;
$$;
