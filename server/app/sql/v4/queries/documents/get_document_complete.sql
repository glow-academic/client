-- Unified get document function - handles both new (document_id = NULL) and detail (document_id provided)
-- Converted to function with composite types
-- Follows ARTIFACT.md pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_document_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_document_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_document_v4_field AS (
    field_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_document_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_document_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_document_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE TYPE types.q_get_document_v4_upload AS (
    uploads_id uuid,
    upload_id uuid,
    file_path text,
    mime_type text,
    size bigint,
    generated boolean,
    group_id uuid
);


-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_document_v4(
    profile_id uuid,
    document_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    document_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_document_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_document_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_document_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_document_v4_description_resource[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_document_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_document_v4_department[],
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_document_v4_field[],
    show_fields boolean,
    fields_agent_id uuid,
    fields_required boolean,
    field_suggestions uuid[],
    fields types.q_get_document_v4_field[],
    -- Multi-select resources: view_uploads_entry
    upload_ids uuid[],
    upload_resources types.q_get_document_v4_upload[],
    show_uploads boolean,
    uploads_agent_id uuid,
    uploads_required boolean,
    upload_suggestions uuid[],
    uploads types.q_get_document_v4_upload[],
    -- Single-select resources: active flag
    active_flag_id uuid,
    flag_resource types.q_get_document_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    general_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        document_id AS document_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check document existence if document_id provided
document_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM document_artifact WHERE id = (SELECT document_id FROM params))::boolean
        END as document_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT
        COALESCE(
            dde.group_id,
            (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    LEFT JOIN draft_domains_entry dde ON dde.draft_id = d.id AND dde.active = TRUE
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get document department data only if document_id provided
document_departments_data AS (
    SELECT 
        dd.document_id,
        ARRAY_AGG(dd.department_id ORDER BY dd.created_at) as department_ids
    FROM params x
    JOIN document_departments_junction dd ON dd.document_id = x.document_id AND dd.active = true
    WHERE x.document_id IS NOT NULL
    GROUP BY dd.document_id
),
document_department_access_check AS (
    SELECT 
        d.id as document_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_type THEN true
            WHEN EXISTS (
                SELECT 1 FROM document_departments_junction dd 
                WHERE dd.document_id = d.id 
                AND dd.active = true 
                AND dd.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM document_departments_junction dd2 
                WHERE dd2.document_id = d.id 
                AND dd2.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN document_artifact d ON d.id = x.document_id
    CROSS JOIN user_profile up
    WHERE x.document_id IS NOT NULL
),
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = ddj.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
    JOIN department_departments_junction ddj ON ddj.departments_id = d.id
),
-- Field suggestions: linked to documents with active=true OR same group with generated=true
field_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(pfr.field_id ORDER BY dpfj.created_at DESC)
             FROM (
                 SELECT DISTINCT pfr.field_id, MAX(dpfj.created_at) as created_at
                 FROM document_parameter_fields_junction dpfj
                 JOIN parameter_fields_resource pfr ON pfr.id = dpfj.parameter_field_id
                 JOIN fields_resource f ON f.id = pfr.field_id
                 JOIN field_fields_junction ffj ON ffj.fields_id = f.id
                 CROSS JOIN draft_group_data dgd
                 WHERE pfr.field_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = ffj.field_id AND fl.name = 'field_active' AND ff.value = true)
                   AND (
                       -- Option 1: Linked to documents with active=true
                       dpfj.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           dpfj.generated = true
                           AND f.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM flags_calls_connection WHERE flags_id = f.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pfr.field_id
                 ORDER BY MAX(dpfj.created_at) DESC
                 LIMIT 20
             ) dpfj
             JOIN parameter_fields_resource pfr ON pfr.field_id = dpfj.field_id),
            ARRAY[]::uuid[]
        ) as field_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Simplified parameter_mapping_data - only used for field_mapping_data
parameter_mapping_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        false as numerical,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND pf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'scenario_parameter' AND pf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'video_parameter' AND pf.value = TRUE) as video_parameter
    FROM parameter_artifact p
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = true) 
      AND EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND pf.value = true)
),
field_mapping_data AS (
    SELECT
        f.id as field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields_resource pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pmd.parameter_id LIMIT 1) as parameter_name,
        COALESCE(f.generated, false) as generated,
        -- Add sort priority: suggested fields first (1), then others (2)
        CASE
            WHEN f.id = ANY(fsd_for_map.field_suggestions) THEN 1
            ELSE 2
        END as sort_priority
    FROM parameter_mapping_data pmd
    CROSS JOIN field_suggestions_data fsd_for_map
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields_resource pf WHERE pf.field_id = f.id LIMIT 1) = pmd.parameter_id
    JOIN field_fields_junction ffj ON ffj.fields_id = f.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = ffj.field_id AND fl.name = 'field_active' AND ff.value = true)
    JOIN parameters_resource p ON p.id = (SELECT pf.parameter_id FROM parameter_fields_resource pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = true)
),
-- Valid fields data for new documents (based on departments, similar to personas endpoint)
valid_fields_data AS (
    SELECT DISTINCT
        f.id as field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields_resource pf WHERE pf.field_id = f.id LIMIT 1) as parameter_id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT pf.parameter_id FROM parameter_fields_resource pf WHERE pf.field_id = f.id LIMIT 1) LIMIT 1) as parameter_name,
        COALESCE(f.generated, false) as generated,
        -- Add sort priority: suggested fields first (1), then others (2)
        CASE
            WHEN f.id = ANY(fsd_for_sort.field_suggestions) THEN 1
            ELSE 2
        END as sort_priority
    FROM params x
    CROSS JOIN user_profile up
    CROSS JOIN field_suggestions_data fsd_for_sort
    LEFT JOIN parameter_fields_resource pf_pf ON pf_pf.parameter_id IN (
        SELECT p.id FROM parameter_artifact p
        WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = TRUE)
          AND EXISTS (SELECT 1 FROM parameter_flags_junction pf2 JOIN flags_resource f ON pf2.flag_id = f.id WHERE pf2.parameter_id = p.id AND f.name = 'document_parameter' AND pf2.value = TRUE)
    )
    LEFT JOIN fields_resource f ON f.id = pf_pf.field_id
    LEFT JOIN field_fields_junction ffj ON ffj.fields_id = f.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = ffj.field_id AND fl.name = 'field_active' AND ff.value = true)
    LEFT JOIN field_departments_junction fd ON fd.field_id = ffj.field_id AND fd.active = true
    WHERE x.document_id IS NULL
      AND f.id IS NOT NULL  -- Filter out NULL fields
      AND (
        -- If user has no departments (superadmin), include only cross-department fields
        (NOT EXISTS (SELECT 1 FROM user_departments) AND up.role = 'superadmin'::profile_type
         AND NOT EXISTS (
             SELECT 1 FROM field_departments_junction fd2
             WHERE fd2.field_id = ffj.field_id
                 AND fd2.active = true
         ))
        OR
        -- If user has departments, include fields from those departments OR cross-department fields
        (EXISTS (SELECT 1 FROM user_departments)
         AND (
             -- Field is in a department the user has access to
             EXISTS (
                 SELECT 1 FROM field_departments_junction fd2
                 WHERE fd2.field_id = ffj.field_id
                   AND fd2.active = true
                   AND fd2.department_id IN (SELECT department_id FROM user_departments)
             )
             OR
             -- Field is cross-department (not in any department)
             NOT EXISTS (
                 SELECT 1 FROM field_departments_junction fd2
                 WHERE fd2.field_id = ffj.field_id
                 AND fd2.active = true
             )
         ))
      )
),
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN
                -- For new documents, check valid_fields_data
                CASE 
                    WHEN (SELECT COUNT(*) FROM valid_fields_data) > 0 THEN true
                    ELSE false
                END
            ELSE
                -- For existing documents, check field_mapping_data
                CASE 
                    WHEN (SELECT COUNT(*) FROM field_mapping_data) > 0 THEN true
                    ELSE false
                END
        END as show_fields,
        -- Uploads: always show if tools exist (view_uploads_entry are always available)
        true as show_uploads
    FROM params x
    CROSS JOIN user_profile up
),
-- Field IDs (selected field IDs for document)
field_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pfr.field_id ORDER BY dpfj.created_at)
                 FROM document_parameter_fields_junction dpfj
                 JOIN parameter_fields_resource pfr ON pfr.id = dpfj.parameter_field_id
                 WHERE dpfj.document_id = (SELECT document_id FROM params)
                   AND dpfj.active = true),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Upload IDs (selected upload IDs for document)
upload_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(dur.uploads_id ORDER BY dur.created_at)
                 FROM document_uploads_resource dur
                 WHERE dur.document_id = (SELECT document_id FROM params)
                   AND dur.active = true),
                ARRAY[]::uuid[]
            )
        END as upload_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Upload mapping data (uploads_resource + view_uploads_entry join)
upload_mapping_data AS (
    SELECT
        ur.id as uploads_id,
        uuc.upload_id,
        u.file_path,
        u.mime_type,
        u.size,
        COALESCE(ur.generated, false) as generated,
        NULL::uuid as group_id
    FROM uploads_resource ur
    JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
    JOIN view_uploads_entry u ON u.id = uuc.upload_id
    WHERE ur.active = true
      AND u.active = true
),
-- Upload suggestions: linked to documents OR same group with generated=true
upload_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dur.uploads_id ORDER BY dur.created_at DESC)
             FROM (
                 SELECT DISTINCT dur.uploads_id, MAX(dur.created_at) as created_at
                 FROM document_uploads_resource dur
                 JOIN uploads_resource ur ON ur.id = dur.uploads_id
                 JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id
                 JOIN view_uploads_entry u ON u.id = uuc.upload_id
                 CROSS JOIN draft_group_data dgd
                 WHERE dur.uploads_id IS NOT NULL
                   AND u.file_path IS NOT NULL
                   AND (
                       -- Option 1: Linked to documents (document_uploads_resource junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       dur.active = true
                       AND (
                           ur.generated = false
                           OR
                           (
                               ur.generated = true
                               AND EXISTS (
                                   SELECT 1 FROM view_calls_entry c
                                   JOIN view_runs_entry r ON r.id = c.run_id
                                   WHERE c.id IN (SELECT call_id FROM uploads_calls_connection WHERE uploads_id = ur.id)
                                     AND r.group_id = dgd.group_id
                               )
                           )
                       )
                   )
                 GROUP BY dur.uploads_id
                 ORDER BY MAX(dur.created_at) DESC
                 LIMIT 20
             ) dur),
            ARRAY[]::uuid[]
        ) as upload_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Document data CTE
document_data AS (
    SELECT 
        d.id as document_id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1),
        EXISTS (SELECT 1 FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'document_active' AND df.value = TRUE) as active,
        (SELECT COUNT(*) FROM scenario_documents_junction sd WHERE sd.document_id = d.id AND sd.active = true) as active_scenario_count,
        (SELECT COUNT(*) FROM scenario_documents_junction sd WHERE sd.document_id = d.id) as total_scenario_links
    FROM params x
    JOIN document_artifact d ON d.id = x.document_id
    WHERE x.document_id IS NOT NULL
),
-- Name suggestions: linked to documents OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dn.name_id ORDER BY dn.created_at DESC)
             FROM (
                 SELECT DISTINCT dn.name_id, MAX(dn.created_at) as created_at
                 FROM document_names_junction dn
                 JOIN names_resource n ON n.id = dn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE dn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to documents (document_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       dn.generated = false
                       OR
                       (
                           dn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM names_calls_connection WHERE names_id = n.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY dn.name_id
                 ORDER BY MAX(dn.created_at) DESC
                 LIMIT 20
             ) dn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to documents OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dd.description_id ORDER BY dd.created_at DESC)
             FROM (
                 SELECT DISTINCT dd.description_id, MAX(dd.created_at) as created_at
                 FROM document_descriptions_junction dd
                 JOIN descriptions_resource d ON d.id = dd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE dd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to documents (document_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       dd.generated = false
                       OR
                       (
                           dd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY dd.description_id
                 ORDER BY MAX(dd.created_at) DESC
                 LIMIT 20
             ) dd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Department suggestions: linked to documents with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dd.department_id ORDER BY dd.created_at DESC)
             FROM (
                 SELECT DISTINCT dd.department_id, MAX(dd.created_at) as created_at
                 FROM document_departments_junction dd
                 JOIN departments_resource d ON d.id = dd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE dd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to documents with active=true
                       dd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           dd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY dd.department_id
                 ORDER BY MAX(dd.created_at) DESC
                 LIMIT 20
             ) dd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Suggested resource objects CTEs - fetch full resource objects for suggestions
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_document_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_document_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_document_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_document_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Resource data CTEs - query from document_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT n.id FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT dn.name_id FROM document_names_junction dn WHERE dn.document_id = (SELECT document_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_document_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM names_drafts_connection dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM document_names_junction dn 
                JOIN names_resource n ON dn.name_id = n.id 
                WHERE dn.document_id = (SELECT document_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT dd.description_id FROM document_descriptions_junction dd WHERE dd.document_id = (SELECT document_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_document_v4_description_resource FROM descriptions_drafts_connection dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_document_v4_description_resource FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = (SELECT document_id FROM params) LIMIT 1) as document_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM flags_drafts_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT df.flag_id FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = (SELECT document_id FROM params) AND f.name = 'document_active' AND df.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_document_v4_flag_resource FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_document_v4_flag_resource FROM document_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = (SELECT document_id FROM params) AND f.name = 'document_active' AND df.value = TRUE LIMIT 1) as document_flag_resource
    FROM params
),
-- Agent selection helper CTEs (shared across all agent selections)
document_department_for_agents AS (
    SELECT dd.department_id
    FROM params p
    JOIN document_departments_junction dd ON dd.document_id = p.document_id AND dd.active = true
    WHERE p.document_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.document_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM document_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags_junction tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'document'::artifact_type
    GROUP BY a.id
),

-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        -- Domain check removed - no longer needed
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        -- Domain check removed - no longer needed
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        -- Domain check removed - no longer needed
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'fields' resource
fields_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        -- Domain check removed - no longer needed
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'fields'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for '' resource
uploads_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'uploads'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'flags' resource
flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        -- Domain check removed - no longer needed
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'general' - agent with ALL document tools (names, descriptions, departments, fields, flags)
general_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        -- Domain check removed - no longer needed
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_tool_resources AS (
        SELECT 
            ea.agent_id,
            COALESCE(
                ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
                ARRAY[]::text[]
            ) as tool_resources,
            ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools_junction at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tools_resource tr ON tr.id = at.tool_id
        LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT 
            atr.agent_id,
            atr.tool_resources,
            ARRAY_LENGTH(
                ARRAY(
                    SELECT unnest(atr.tool_resources)
                    EXCEPT
                    SELECT unnest(ARRAY['names', 'descriptions', 'departments', 'fields', 'flags']::text[])
                ),
                1
            ) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['names', 'descriptions', 'departments', 'fields', 'flags']::text[] <@ atr.tool_resources
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = atr.agent_id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.unmatched_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ascores.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Check for missing tools on required resources (after all agent selection CTEs and ui_flags)
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'fields'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as fields_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'uploads'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as uploads_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.fields_has_tools AND uf.show_fields THEN 'fields' ELSE NULL END,
            CASE WHEN NOT tec.uploads_has_tools AND uf.show_uploads THEN '' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        ddd.department_ids,
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN dd.active_scenario_count > 0 THEN false
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN dd.active_scenario_count > 0 THEN 
                        'This document is currently in use by scenarios and cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN up.role IN ('admin'::profile_type, 'instructional'::profile_type, 'superadmin'::profile_type) THEN 
                        NULL::text
                    ELSE 
                        'This document cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN document_departments_data ddd ON true
    LEFT JOIN document_data dd ON dd.document_id = x.document_id
    CROSS JOIN user_profile up
),
permissions_final AS (
    SELECT 
        pd.department_ids,
        mtc.missing_resources,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT document_exists FROM document_exists_check) as document_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_document_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.document_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_document_v4_description_resource[]) as descriptions,
    -- Multi-select resources: departments
    COALESCE(
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN
                -- For new documents, leave department_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE ddd.department_ids
        END,
        ARRAY[]::uuid[]
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_document_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT document_id FROM params) IS NULL THEN
                        -- For new documents, leave department_ids empty (no auto-selection)
                        ARRAY[]::uuid[]
                    ELSE ddd.department_ids
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_document_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_document_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_document_v4_department[]
    ) as departments,
    -- Multi-select resources: fields
    fid.field_ids,
    -- Field resources (selected fields filtered by field_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.generated)::types.q_get_document_v4_field
            ORDER BY fmd.sort_priority, fmd.name
        )
        FROM (SELECT DISTINCT field_id, name, description, generated, sort_priority FROM field_mapping_data WHERE field_id = ANY(fid.field_ids)) fmd),
        '{}'::types.q_get_document_v4_field[]
    ) as field_resources,
    CASE 
        WHEN NOT tec.fields_has_tools AND uf.show_fields THEN false
        ELSE uf.show_fields
    END as show_fields,
    (SELECT agent_id FROM fields_agent_data) as fields_agent_id,
    CASE 
        WHEN uf.show_fields THEN true
        ELSE false
    END as fields_required,
    COALESCE((SELECT field_suggestions FROM field_suggestions_data), ARRAY[]::uuid[]) as field_suggestions,
    COALESCE(
        CASE 
            WHEN (SELECT document_id FROM params) IS NULL THEN
                -- For new documents, use valid_fields_data
                (SELECT ARRAY_AGG(
                    (vfd.field_id, vfd.name, vfd.description, vfd.generated)::types.q_get_document_v4_field
                    ORDER BY vfd.sort_priority, vfd.name
                ) FROM (
                    SELECT DISTINCT vfd.field_id, vfd.name, vfd.description, vfd.generated, vfd.sort_priority
                    FROM valid_fields_data vfd
                    WHERE vfd.field_id IS NOT NULL
                ) vfd)
            ELSE
                -- For existing documents, use field_mapping_data
                (SELECT ARRAY_AGG(
                    (fmd.field_id, fmd.name, fmd.description, fmd.generated)::types.q_get_document_v4_field
                    ORDER BY fmd.sort_priority, fmd.name
                ) FROM (
                    SELECT DISTINCT fmd.field_id, fmd.name, fmd.description, fmd.generated, fmd.sort_priority
                    FROM field_mapping_data fmd
                    WHERE fmd.field_id IS NOT NULL
                ) fmd)
        END,
        '{}'::types.q_get_document_v4_field[]
    ) as fields,
    -- Multi-select resources: view_uploads_entry
    uid.upload_ids,
    -- Upload resources (selected view_uploads_entry filtered by upload_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (umd.uploads_id, umd.upload_id, umd.file_path, umd.mime_type, umd.size, umd.generated, umd.group_id)::types.q_get_document_v4_upload
            ORDER BY umd.upload_id
        )
        FROM (SELECT DISTINCT uploads_id, upload_id, file_path, mime_type, size, generated, group_id FROM upload_mapping_data WHERE uploads_id = ANY(uid.upload_ids)) umd),
        '{}'::types.q_get_document_v4_upload[]
    ) as upload_resources,
    CASE 
        WHEN NOT tec.uploads_has_tools AND uf.show_uploads THEN false
        ELSE uf.show_uploads
    END as show_uploads,
    (SELECT agent_id FROM uploads_agent_data) as uploads_agent_id,
    CASE 
        WHEN uf.show_uploads THEN true
        ELSE false
    END as uploads_required,
    COALESCE((SELECT upload_suggestions FROM upload_suggestions_data), ARRAY[]::uuid[]) as upload_suggestions,
    COALESCE(
        -- All available view_uploads_entry (all uploads_resource entries that are active)
        (SELECT ARRAY_AGG(
            (umd.uploads_id, umd.upload_id, umd.file_path, umd.mime_type, umd.size, umd.generated, umd.group_id)::types.q_get_document_v4_upload
            ORDER BY 
                CASE WHEN umd.uploads_id = ANY(usd.upload_suggestions) THEN 1 ELSE 2 END,
                umd.upload_id
        ) FROM (
            SELECT DISTINCT uploads_id, upload_id, file_path, mime_type, size, generated, group_id
            FROM upload_mapping_data
            WHERE uploads_id IS NOT NULL
        ) umd
        CROSS JOIN upload_suggestions_data usd),
        '{}'::types.q_get_document_v4_upload[]
    ) as uploads,
    -- Single-select resources: active flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.document_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    -- Multi-resource combination agent IDs
    (SELECT agent_id FROM general_agent_data) as general_agent_id
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN document_departments_data ddd ON true
LEFT JOIN document_data dd ON dd.document_id = (SELECT document_id FROM params)
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN field_ids_data fid
CROSS JOIN upload_ids_data uid
CROSS JOIN upload_suggestions_data usd
CROSS JOIN field_suggestions_data fsd
$$;
