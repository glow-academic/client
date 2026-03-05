-- Document ID Fetching (Query 2 of Two-Pass Architecture)
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
        WHERE proname = 'api_get_document_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS document_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_document_ids_v4(
    profile_id uuid,
    document_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or document junction)
    names_id uuid,
    descriptions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    field_ids uuid[],
    upload_ids uuid[],
    image_ids uuid[],
    text_ids uuid[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    department_suggestions uuid[],
    field_suggestions uuid[],
    upload_suggestions uuid[],
    image_suggestions uuid[],
    text_suggestions uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        document_id AS document_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Document junction multi-select resource IDs (canonical only).
document_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
                 FROM document_departments_junction dd
                 WHERE dd.document_id = (SELECT document_id FROM params) AND dd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
document_fields_data AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(dpfj.parameter_fields_id ORDER BY dpfj.created_at)
                 FROM document_parameter_fields_junction dpfj
                 WHERE dpfj.document_id = (SELECT document_id FROM params) AND dpfj.active = true),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    LIMIT 1
),
document_uploads_data AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(du.files_id ORDER BY du.created_at)
                 FROM document_files_junction du
                 WHERE du.document_id = (SELECT document_id FROM params) AND du.active = true),
                ARRAY[]::uuid[]
            )
        END as upload_ids
    FROM params
    LIMIT 1
),
document_images_data AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(di.images_id ORDER BY di.created_at)
                 FROM document_images_junction di
                 WHERE di.document_id = (SELECT document_id FROM params) AND di.active = true),
                ARRAY[]::uuid[]
            )
        END as image_ids
    FROM params
    LIMIT 1
),
document_texts_data AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(dt.texts_id ORDER BY dt.created_at)
                 FROM document_texts_junction dt
                 WHERE dt.document_id = (SELECT document_id FROM params) AND dt.active = true),
                ARRAY[]::uuid[]
            )
        END as text_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT dn.names_id FROM document_names_junction dn WHERE dn.document_id = (SELECT document_id FROM params) AND dn.active = true LIMIT 1) as names_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT dd.descriptions_id FROM document_descriptions_junction dd WHERE dd.document_id = (SELECT document_id FROM params) AND dd.active = true LIMIT 1) as descriptions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT df.flags_id
         FROM document_flags_junction df
         JOIN flags_resource f ON df.flags_id = f.id
         WHERE df.document_id = (SELECT document_id FROM params)
           AND df.active = true
           AND f.name = 'document_active'
           AND f.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
)
SELECT
    -- Single-select resource IDs
    (SELECT names_id FROM name_resource_data) as names_id,
    (SELECT descriptions_id FROM description_resource_data) as descriptions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM document_departments_data) as department_ids,
    (SELECT field_ids FROM document_fields_data) as field_ids,
    (SELECT upload_ids FROM document_uploads_data) as upload_ids,
    (SELECT image_ids FROM document_images_data) as image_ids,
    (SELECT text_ids FROM document_texts_data) as text_ids,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as department_suggestions,
    ARRAY[]::uuid[] as field_suggestions,
    ARRAY[]::uuid[] as upload_suggestions,
    ARRAY[]::uuid[] as image_suggestions,
    ARRAY[]::uuid[] as text_suggestions
FROM params x;
$$;
