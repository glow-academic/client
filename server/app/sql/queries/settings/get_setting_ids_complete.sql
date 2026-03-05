-- Setting ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

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

DROP TYPE IF EXISTS setting_candidate_agent CASCADE;

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
    names_id uuid,
    descriptions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs (merged: draft overrides canonical)
    color_ids uuid[],
    department_ids uuid[],
    profile_ids uuid[],
    auth_ids uuid[],
    provider_key_ids uuid[],
    auth_item_key_ids uuid[],

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
    SELECT pn.names_id
    FROM setting_names_junction pn
    WHERE pn.setting_id = (SELECT setting_id FROM params) AND pn.active = true
    LIMIT 1
),
canonical_description AS (
    SELECT pd.descriptions_id
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
      AND f.value = TRUE
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
        ARRAY_AGG(spk.provider_keys_id ORDER BY spk.created_at),
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
-- ========== DRAFT IDs (override canonical when draft exists) ==========
draft_name AS (
    SELECT ndc.names_id as names_id
    FROM setting_drafts_names_connection ndc
    WHERE ndc.draft_id = (SELECT draft_id FROM params)
    LIMIT 1
),
draft_description AS (
    SELECT ddc.descriptions_id as descriptions_id
    FROM setting_drafts_descriptions_connection ddc
    WHERE ddc.draft_id = (SELECT draft_id FROM params)
    LIMIT 1
),
draft_flag AS (
    SELECT fdc.flag_id as active_flag_id
    FROM setting_drafts_flags_connection fdc
    WHERE fdc.draft_id = (SELECT draft_id FROM params)
    LIMIT 1
),
draft_colors AS (
    SELECT COALESCE(
        ARRAY_AGG(cdc.color_id),
        ARRAY[]::uuid[]
    ) as color_ids
    FROM setting_drafts_colors_connection cdc
    WHERE cdc.draft_id = (SELECT draft_id FROM params)
),
draft_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(ddc.department_id),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM setting_drafts_departments_connection ddc
    WHERE ddc.draft_id = (SELECT draft_id FROM params)
),
draft_profiles AS (
    SELECT COALESCE(
        ARRAY_AGG(pdc.profile_id),
        ARRAY[]::uuid[]
    ) as profile_ids
    FROM setting_drafts_profiles_connection pdc
    WHERE pdc.draft_id = (SELECT draft_id FROM params)
      AND pdc.profile_id != (SELECT profile_id FROM params)  -- Exclude the owner profile
),
draft_provider_keys AS (
    SELECT COALESCE(
        ARRAY_AGG(pdc.provider_keys_id),
        ARRAY[]::uuid[]
    ) as provider_key_ids
    FROM setting_drafts_provider_keys_connection pdc
    WHERE pdc.draft_id = (SELECT draft_id FROM params)
),
draft_auth_item_keys AS (
    SELECT COALESCE(
        ARRAY_AGG(kdc.auth_item_keys_id),
        ARRAY[]::uuid[]
    ) as auth_item_key_ids
    FROM setting_drafts_auth_item_keys_connection kdc
    WHERE kdc.draft_id = (SELECT draft_id FROM params)
),
-- ========== MERGED IDs (draft overrides canonical) ==========
merged_ids AS (
    SELECT
        -- Single-select: COALESCE draft over canonical
        COALESCE((SELECT names_id FROM draft_name), (SELECT names_id FROM canonical_name)) as names_id,
        COALESCE((SELECT descriptions_id FROM draft_description), (SELECT descriptions_id FROM canonical_description)) as descriptions_id,
        COALESCE((SELECT active_flag_id FROM draft_flag), (SELECT active_flag_id FROM canonical_flag)) as active_flag_id,
        -- Multi-select: use draft if draft has entries, else canonical
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_drafts_colors_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT color_ids FROM draft_colors)
            ELSE (SELECT color_ids FROM canonical_colors)
        END as color_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_drafts_departments_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT department_ids FROM draft_departments)
            ELSE (SELECT department_ids FROM canonical_departments)
        END as department_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_drafts_profiles_connection pdc WHERE pdc.draft_id = (SELECT draft_id FROM params) AND pdc.profile_id != (SELECT profile_id FROM params))
            THEN (SELECT profile_ids FROM draft_profiles)
            ELSE (SELECT profile_ids FROM canonical_profiles)
        END as profile_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_auths_junction WHERE settings_id = (SELECT setting_id FROM params))
            THEN (SELECT auth_ids FROM canonical_auths)
            ELSE (SELECT auth_ids FROM canonical_auths)
        END as auth_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_drafts_provider_keys_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT provider_key_ids FROM draft_provider_keys)
            ELSE (SELECT provider_key_ids FROM canonical_provider_keys)
        END as provider_key_ids,
        CASE WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM setting_drafts_auth_item_keys_connection WHERE draft_id = (SELECT draft_id FROM params))
            THEN (SELECT auth_item_key_ids FROM draft_auth_item_keys)
            ELSE (SELECT auth_item_key_ids FROM canonical_auth_item_keys)
        END as auth_item_key_ids
),
-- ========== CONFIG CHAIN (departments -> settings -> systems -> agents -> models -> providers) ==========
config_settings AS (
    SELECT DISTINCT unnest(dr.setting_ids) as setting_id
    FROM departments_resource dr
    WHERE dr.id = ANY(user_department_ids)
      AND dr.active = true
      AND dr.setting_ids IS NOT NULL
      AND dr.setting_ids != ARRAY[]::uuid[]
),
config_systems_data AS (
    SELECT DISTINCT ssj.systems_id as system_id
    FROM config_settings cs
    JOIN setting_systems_junction ssj ON ssj.setting_id = cs.setting_id
    WHERE ssj.active = true
),
config_systems_resource_data AS (
    SELECT sr.id, sr.agent_ids
    FROM systems_resource sr
    JOIN config_systems_data csd ON sr.id = csd.system_id
    WHERE sr.active = true
),
config_agent_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT agent_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM (
        SELECT unnest(csrd.agent_ids) as agent_id
        FROM config_systems_resource_data csrd
        WHERE csrd.agent_ids IS NOT NULL AND csrd.agent_ids != ARRAY[]::uuid[]
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
)
SELECT
    -- Single-select merged IDs
    m.names_id,
    m.descriptions_id,
    m.active_flag_id,

    -- Multi-select merged IDs
    m.color_ids,
    m.department_ids,
    m.profile_ids,
    m.auth_ids,
    m.provider_key_ids,
    m.auth_item_key_ids,

    -- Config chain resource IDs
    (SELECT ids FROM config_agent_resource_ids_data) as config_agent_resource_ids,
    (SELECT ids FROM config_model_resource_ids_data) as config_model_resource_ids,
    (SELECT ids FROM config_provider_resource_ids_data) as config_provider_resource_ids
FROM merged_ids m;
$$;
