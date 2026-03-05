-- Auth ID Fetching (Query 2 of Two-Pass Architecture)
-- Returns all resource IDs for parallel resource fetching
-- Agent/tool resolution moved to settings layer in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_auth_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS auth_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_auth_ids_v4(
    profile_id uuid,
    auth_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or auth junction)
    names_id uuid,
    descriptions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    protocol_ids uuid[],
    slug_ids uuid[],

    -- Auth items (special junction)
    auth_item_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        auth_id AS auth_id,
        draft_id AS draft_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Convert auths_resource.id to auth_artifact.id
auth_artifact_id_lookup AS (
    SELECT
        CASE
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::uuid
            ELSE COALESCE(
                (SELECT aaj.auth_id FROM auths_resource ar JOIN auth_auths_junction aaj ON aaj.auth_id = ar.id WHERE ar.id = (SELECT auth_id FROM params)),
                (SELECT auth_id FROM params)
            )
        END as auth_artifact_id
),
-- Draft resource IDs (if draft_id is provided)
draft_name_data AS (
    SELECT ndc.names_id as names_id
    FROM auth_drafts_names_connection ndc
    WHERE ndc.draft_id = (SELECT draft_id FROM params)
    ORDER BY ndc.version DESC
    LIMIT 1
),
draft_description_data AS (
    SELECT ddc.descriptions_id as descriptions_id
    FROM auth_drafts_descriptions_connection ddc
    WHERE ddc.draft_id = (SELECT draft_id FROM params)
    ORDER BY ddc.version DESC
    LIMIT 1
),
draft_flag_data AS (
    SELECT fdc.flags_id as flag_id
    FROM auth_drafts_flags_connection fdc
    WHERE fdc.draft_id = (SELECT draft_id FROM params)
    ORDER BY fdc.version DESC
    LIMIT 1
),
draft_protocol_data AS (
    SELECT COALESCE(ARRAY_AGG(pdc.protocols_id), ARRAY[]::uuid[]) as protocol_ids
    FROM auth_drafts_protocols_connection pdc
    WHERE pdc.draft_id = (SELECT draft_id FROM params)
),
draft_slug_data AS (
    SELECT COALESCE(ARRAY_AGG(sdc.slugs_id), ARRAY[]::uuid[]) as slug_ids
    FROM auth_drafts_slugs_connection sdc
    WHERE sdc.draft_id = (SELECT draft_id FROM params)
),
-- Single-select resource IDs (draft overrides canonical)
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT names_id FROM draft_name_data),
            (SELECT an.names_id FROM auth_names_junction an WHERE an.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) LIMIT 1)
        ) as names_id
    FROM params
),
description_resource_data AS (
    SELECT
        COALESCE(
            (SELECT descriptions_id FROM draft_description_data),
            (SELECT ad.descriptions_id FROM auth_descriptions_junction ad WHERE ad.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) LIMIT 1)
        ) as descriptions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT flag_id FROM draft_flag_data),
            (SELECT af.flags_id
             FROM auth_flags_junction af
             JOIN flags_resource f ON af.flags_id = f.id
             WHERE af.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)
               AND f.name = 'auth_active'
               AND f.value = TRUE
             LIMIT 1)
        ) as active_flag_id
    FROM params
),
-- Multi-select resource IDs (draft overrides canonical)
protocol_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM draft_protocol_data WHERE array_length(protocol_ids, 1) > 0)
                THEN (SELECT protocol_ids FROM draft_protocol_data)
            WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ap.protocols_id ORDER BY ap.created_at)
                 FROM auth_protocols_junction ap
                 WHERE ap.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)),
                ARRAY[]::uuid[]
            )
        END as protocol_ids
    FROM params
    LIMIT 1
),
slug_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM draft_slug_data WHERE array_length(slug_ids, 1) > 0)
                THEN (SELECT slug_ids FROM draft_slug_data)
            WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(asj.slugs_id ORDER BY asj.created_at)
                 FROM auth_slugs_junction asj
                 WHERE asj.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)),
                ARRAY[]::uuid[]
            )
        END as slug_ids
    FROM params
    LIMIT 1
),
-- Auth item IDs
auth_item_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (
                SELECT 1
                FROM auth_drafts_items_connection idc
                WHERE idc.draft_id = (SELECT draft_id FROM params)
            )
                THEN COALESCE(
                    (
                        SELECT ARRAY_AGG(idc.item_id ORDER BY i.position)
                        FROM auth_drafts_items_connection idc
                        JOIN items_resource i ON i.id = idc.item_id
                        WHERE idc.draft_id = (SELECT draft_id FROM params)
                    ),
                    ARRAY[]::uuid[]
                )
            WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(aij.items_id ORDER BY i.position)
                 FROM auth_items_junction aij
                 JOIN items_resource i ON i.id = aij.items_id
                 WHERE aij.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)),
                ARRAY[]::uuid[]
            )
        END as auth_item_ids
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select resource IDs
    (SELECT names_id FROM name_resource_data) as names_id,
    (SELECT descriptions_id FROM description_resource_data) as descriptions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT protocol_ids FROM protocol_ids_data) as protocol_ids,
    (SELECT slug_ids FROM slug_ids_data) as slug_ids,

    -- Auth item IDs
    (SELECT auth_item_ids FROM auth_item_ids_data) as auth_item_ids
FROM params x;
$$;
