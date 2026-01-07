-- Get document detail with mappings and template info
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_document_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_document_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_document_detail_v4_department AS (
    department_id uuid,
    name text,
    description text,
    parameter_ids text[]
);

CREATE TYPE types.q_get_document_detail_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_document_detail_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_get_document_detail_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_document_detail_v4_template AS (
    template_id uuid,
    schema_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_document_detail_v4(
    document_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    document_exists boolean,
    document_id uuid,
    name text,
    description text,
    active boolean,
    type text,
    upload_id uuid,
    updated_at timestamptz,
    extension text,
    scenario_ids uuid[],
    can_edit boolean,
    can_delete boolean,
    document_type_options text[],
    department_ids text[],
    valid_department_ids text[],
    departments types.q_get_document_detail_v4_department[],
    field_ids uuid[],
    valid_field_ids text[],
    fields types.q_get_document_detail_v4_field[],
    linked_parameter_ids text[],
    parameters types.q_get_document_detail_v4_parameter[],
    document_domain_id uuid,
    agents types.q_get_document_detail_v4_agent[],
    valid_agent_ids text[],
    template boolean,
    template_id uuid,
    schema_id uuid,
    html_id uuid,
    template_file_path text,
    template_html text,
    templates types.q_get_document_detail_v4_template[],
    actor_name text,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT document_id AS document_id,
           profile_id AS profile_id,
           draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'documents'::draft_resource_type
    LIMIT 1
),
document_exists_check AS (
    -- Check if document exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM documents WHERE id = (SELECT document_id FROM params)
    )::boolean as document_exists
),
document_data AS (
    SELECT 
        d.id as document_id,
        d.name,
        d.description,
        d.active,
        d.updated_at,
        d.document_domain_id,
        (SELECT ARRAY_AGG(dd.department_id::text) FROM document_departments dd WHERE dd.document_id = d.id AND dd.active = true) as department_ids,
        (SELECT ARRAY_AGG(df.field_id) FROM document_fields df WHERE df.document_id = d.id AND df.active = true) as field_ids,
        (SELECT du.upload_id FROM document_uploads du WHERE du.document_id = d.id AND du.active = true ORDER BY du.created_at DESC LIMIT 1) as upload_id,
        (SELECT dh.html_id FROM document_html dh WHERE dh.document_id = d.id AND dh.active = true ORDER BY dh.created_at DESC LIMIT 1) as html_id,
        (SELECT ds.schema_id FROM document_schemas ds WHERE ds.document_id = d.id AND ds.active = true ORDER BY ds.created_at DESC LIMIT 1) as schema_id,
        (SELECT u.file_path FROM document_uploads du 
         JOIN uploads u ON u.id = du.upload_id 
         WHERE du.document_id = d.id AND du.active = true ORDER BY du.created_at DESC LIMIT 1) as file_path,
        (SELECT u.file_path FROM document_html dh
         JOIN html h ON h.id = dh.html_id
         JOIN html_uploads hu ON hu.html_id = h.id AND hu.active = true
         JOIN uploads u ON u.id = hu.upload_id 
         WHERE dh.document_id = d.id AND dh.active = true ORDER BY dh.created_at DESC LIMIT 1) as template_file_path,
        d.template,
        (SELECT ARRAY_AGG(DISTINCT st.parent_id) FROM scenario_documents sd
         JOIN scenario_tree st ON st.child_id = sd.scenario_id AND st.parent_id = st.child_id
         WHERE sd.document_id = d.id AND sd.active = true) as scenario_ids,
        (SELECT COUNT(*) FROM scenario_documents sd WHERE sd.document_id = d.id AND sd.active = true) as active_scenario_count,
        (SELECT COUNT(*) FROM scenario_documents sd WHERE sd.document_id = d.id) as total_scenario_links
    FROM params x
    JOIN documents d ON d.id = x.document_id
),
document_active_template AS (
    SELECT 
        dt.document_id,
        dt.template_id,
        ds.schema_id,
        dt.created_at as template_created_at,
        dt.updated_at as template_updated_at
    FROM params x
    JOIN document_templates dt ON dt.document_id = x.document_id AND dt.active = true
    LEFT JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.active = true
    ORDER BY dt.created_at DESC
    LIMIT 1
),
document_all_templates AS (
    SELECT 
        dt.document_id,
        dt.template_id,
        ds.schema_id,
        dt.active as template_active,
        dt.created_at as template_created_at,
        dt.updated_at as template_updated_at
    FROM params x
    JOIN document_templates dt ON dt.document_id = x.document_id
    LEFT JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.active = dt.active
),
user_profile AS (
    SELECT 
        role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM params x
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
department_parameter_ids AS (
    SELECT 
        ud.id as department_id,
        COALESCE(ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) as parameter_ids
    FROM user_departments ud
    LEFT JOIN parameters p ON p.active = true
    LEFT JOIN fields f ON f.parameter_id = p.id AND f.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE (fd.department_id = ud.id OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                                                     JOIN fields f2 ON f2.id = fd2.field_id 
                                                     WHERE f2.parameter_id = p.id AND f2.active = true AND fd2.active = true))
    GROUP BY ud.id
),
department_data AS (
    SELECT 
        ud.id as department_id,
        ud.name,
        COALESCE(ud.description, '') as description,
        COALESCE(dparami.parameter_ids, ARRAY[]::text[]) as parameter_ids
    FROM user_departments ud
    LEFT JOIN department_parameter_ids dparami ON dparami.department_id = ud.id
),
linked_parameters AS (
    -- Note: parameter_documents junction table removed - parameters no longer directly linked to documents
    -- Return empty result since we can't determine which parameters are linked
    SELECT 
        NULL::uuid as parameter_id,
        NULL::text as parameter_name,
        NULL::text as parameter_description,
        false as persona_parameter,
        false as scenario_parameter,
        false as video_parameter
    WHERE false
),
parameter_data AS (
    SELECT 
        lp.parameter_id,
        lp.parameter_name as name,
        lp.parameter_description as description,
        true as document_parameter,
        lp.persona_parameter,
        lp.scenario_parameter,
        lp.video_parameter
    FROM linked_parameters lp
),
field_data AS (
    SELECT 
        f.id as field_id,
        f.name,
        COALESCE(f.description, '') as description,
        f.parameter_id,
        p.name as parameter_name
    FROM linked_parameters lp
    JOIN fields f ON f.parameter_id = lp.parameter_id AND f.active = true
    JOIN parameters p ON p.id = f.parameter_id
    CROSS JOIN document_data dd
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE p.active = true
      AND (
          -- Department-based filtering: include if matches department OR has no department restrictions
          (
              (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
              AND NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
          )
          OR (
              dd.department_ids IS NOT NULL 
              AND array_length(dd.department_ids, 1) > 0
              AND fd.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
          )
          -- Include fields already assigned to this document even if they don't pass department filter
          OR f.id::text = ANY(COALESCE((SELECT ARRAY_AGG(field_id::text) FROM document_fields df WHERE df.document_id = dd.document_id AND df.active = true), ARRAY[]::text[]))
      )
),
user_departments_for_agents AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
agent_data AS (
    -- Get agents with roles 'classify' or 'document'
    -- Filter by department access: include if has matching department link OR has no department links at all (cross-dept)
    -- Also include agents assigned to this document (classify_agent_id or document_agent_id) even if they don't pass department filter
    SELECT 
        a.id as agent_id,
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[COALESCE(d.artifact::text, '')] as roles
    FROM params x
    JOIN agents a ON a.active = true
    JOIN domains d ON d.agent_id = a.id AND d.artifact = CAST('document' AS artifacts)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    CROSS JOIN document_data dd
    WHERE (
        -- Department access: has matching department link OR has no department links at all (cross-dept)
        EXISTS (
            SELECT 1 FROM agent_departments ad2 
            WHERE ad2.agent_id = a.id 
            AND ad2.active = true 
            AND ad2.department_id IN (SELECT department_id FROM user_departments_for_agents)
        )
        OR NOT EXISTS (
            SELECT 1 FROM agent_departments ad3 
            WHERE ad3.agent_id = a.id 
            AND ad3.active = true
        )
        -- Include agents assigned to this document even if they don't pass department filter
        OR EXISTS (SELECT 1 FROM domains d2 WHERE d2.id = dd.document_domain_id AND d2.agent_id = a.id)
    )
),
valid_field_ids_data AS (
    SELECT 
        dd.document_id,
        COALESCE(
            ARRAY_AGG(DISTINCT f.id::text ORDER BY f.id::text) FILTER (WHERE f.id IS NOT NULL),
            ARRAY[]::text[]
        ) as valid_field_ids
    FROM document_data dd
    LEFT JOIN fields f_pf ON f_pf.parameter_id IN (SELECT id FROM parameters WHERE active = true) AND f_pf.active = true
    LEFT JOIN fields f ON f.id = f_pf.id AND f.active = true
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE (
        -- If document has no departments, include only cross-department fields
        (dd.department_ids IS NULL OR array_length(dd.department_ids, 1) = 0)
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            WHERE fd2.field_id = f.id 
            AND fd2.active = true
        )
    ) OR (
        -- If document has departments, include fields from those departments OR cross-department fields
        dd.department_ids IS NOT NULL 
        AND array_length(dd.department_ids, 1) > 0
        AND (
            fd.department_id = ANY(SELECT unnest(dd.department_ids)::uuid)
            OR NOT EXISTS (
                SELECT 1 FROM field_departments fd2 
                WHERE fd2.field_id = f.id 
                AND fd2.active = true
            )
        )
    )
    GROUP BY dd.document_id
)
SELECT 
    -- Existence check (always returned)
    dec.document_exists::boolean as document_exists,
    -- Document fields
    dd.document_id::uuid as document_id,
    -- Merge draft payload over existing document data if draft_id provided
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        dd.name
    )::text as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        COALESCE(dd.description, '')
    )::text as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        dd.active
    )::boolean as active,
    CASE 
        WHEN dd.file_path IS NOT NULL THEN SUBSTRING(dd.file_path FROM '\\.([^\\.]+)$')
        ELSE ''
    END::text as type,
    dd.upload_id::uuid as upload_id,
    dd.updated_at::timestamptz as updated_at,
    CASE 
        WHEN dd.file_path IS NOT NULL THEN SUBSTRING(dd.file_path FROM '\\.([^\\.]+)$')
        ELSE NULL
    END::text as extension,
    COALESCE(dd.scenario_ids, ARRAY[]::uuid[])::uuid[] as scenario_ids,
    CASE 
        WHEN dd.active_scenario_count > 0 THEN false
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END::boolean as can_edit,
    CASE 
        WHEN dd.total_scenario_links > 0 THEN false
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END::boolean as can_delete,
    ARRAY['homework', 'exam', 'lab', 'project']::text[] as document_type_options,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(dd.department_ids, ARRAY[]::text[])
    )::text[] as department_ids,
    COALESCE((SELECT ARRAY_AGG(dd2.department_id::text ORDER BY dd2.department_id::text) FROM department_data dd2), ARRAY[]::text[])::text[] as valid_department_ids,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd2.department_id, dd2.name, dd2.description, dd2.parameter_ids)::types.q_get_document_detail_v4_department
            ORDER BY dd2.name
        ) FROM department_data dd2),
        '{}'::types.q_get_document_detail_v4_department[]
    ) as departments,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'parameter_item_ids' IS NOT NULL AND jsonb_typeof(payload->'parameter_item_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'parameter_item_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(dd.field_ids, ARRAY[]::uuid[])
    )::uuid[] as field_ids,
    COALESCE(vfid.valid_field_ids, ARRAY[]::text[])::text[] as valid_field_ids,
    -- Aggregate fields separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.field_id, fd.name, fd.description, fd.parameter_id, fd.parameter_name)::types.q_get_document_detail_v4_field
            ORDER BY fd.name
        ) FROM field_data fd),
        '{}'::types.q_get_document_detail_v4_field[]
    ) as fields,
    COALESCE((SELECT ARRAY_AGG(pd.parameter_id::text ORDER BY pd.name) FROM parameter_data pd), ARRAY[]::text[])::text[] as linked_parameter_ids,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.parameter_id, pd.name, pd.description, pd.document_parameter, pd.persona_parameter, pd.scenario_parameter, pd.video_parameter)::types.q_get_document_detail_v4_parameter
            ORDER BY pd.name
        ) FROM parameter_data pd),
        '{}'::types.q_get_document_detail_v4_parameter[]
    ) as parameters,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->>'document_domain_id' IS NOT NULL AND payload->>'document_domain_id' != 'null' THEN
                    (payload->>'document_domain_id')::uuid
                ELSE NULL
            END
        FROM draft_payload_data),
        dd.document_domain_id
    )::uuid as document_domain_id,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (ad.agent_id, ad.name, ad.description, ad.roles)::types.q_get_document_detail_v4_agent
            ORDER BY ad.name
        ) FROM agent_data ad),
        '{}'::types.q_get_document_detail_v4_agent[]
    ) as agents,
    COALESCE((SELECT ARRAY_AGG(ad2.agent_id::text ORDER BY ad2.name) FROM agent_data ad2), ARRAY[]::text[])::text[] as valid_agent_ids,
    dd.template::boolean as template,
    dat.template_id::uuid as template_id,
    dat.schema_id::uuid as schema_id,
    dd.html_id::uuid as html_id,
    dd.template_file_path::text as template_file_path,
    NULL::text as template_html,  -- Will be populated in Python from file system
    -- Aggregate templates separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dat2.template_id, dat2.schema_id, dat2.template_active, dat2.template_created_at, dat2.template_updated_at)::types.q_get_document_detail_v4_template
            ORDER BY dat2.template_created_at DESC
        ) FROM document_all_templates dat2),
        '{}'::types.q_get_document_detail_v4_template[]
    ) as templates,
    up.actor_name::text as actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0)::int as draft_version
FROM document_exists_check dec
CROSS JOIN user_profile up
LEFT JOIN document_data dd ON dec.document_exists = true
LEFT JOIN document_active_template dat ON dat.document_id = dd.document_id AND dec.document_exists = true
LEFT JOIN valid_field_ids_data vfid ON vfid.document_id = dd.document_id AND dec.document_exists = true
LIMIT 1
$$;