-- Unified save document function - handles both create (document_id = NULL) and update (document_id provided)
-- Converted to function
-- Follows save_persona_complete.sql pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_document_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_document_v4(
    name_id uuid,
    department_ids uuid[],
    profile_id uuid,
    field_ids uuid[],
    input_document_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    upload_ids uuid[] DEFAULT ARRAY[]::uuid[],
    html_id uuid DEFAULT NULL,
    schema_id uuid DEFAULT NULL
)
RETURNS TABLE (
    document_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_document_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_document_id IS NULL);
    
    -- Create or UPDATE document_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO document_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_document_id;
    ELSE
        -- UPDATE path
        v_document_id := input_document_id;
        UPDATE document_artifact
        SET updated_at = NOW()
        WHERE id = v_document_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    IF template_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = template_flag_id) THEN
        RAISE EXCEPTION 'Template flag resource not found: %', template_flag_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM document_names_junction WHERE document_id = v_document_id;
        DELETE FROM document_descriptions_junction WHERE document_id = v_document_id;
        DELETE FROM document_departments_junction WHERE document_id = v_document_id;
        DELETE FROM document_parameter_fields_junction WHERE document_id = v_document_id;
        DELETE FROM document_parameters_junction WHERE document_id = v_document_id;
        DELETE FROM document_uploads_resource WHERE document_id = v_document_id;
        -- Update existing active flag if it exists
        UPDATE document_flags_junction SET
            flag_id = COALESCE(api_save_document_v4.active_flag_id, document_flags_junction.flag_id),
            value = CASE WHEN api_save_document_v4.active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE document_id = v_document_id
          ;
        -- Update existing template flag if it exists
        UPDATE document_flags_junction SET
            flag_id = COALESCE(api_save_document_v4.template_flag_id, document_flags_junction.flag_id),
            value = CASE WHEN api_save_document_v4.template_flag_id IS NOT NULL THEN true ELSE false END
        WHERE document_id = v_document_id
          ;
    END IF;
    
    -- Continue with document save using SQL (document already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_document_id AS document_id,
            name_id,
            description_id,
            active_flag_id,
            template_flag_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            profile_id,
            COALESCE(field_ids, ARRAY[]::uuid[]) AS field_ids,
            COALESCE(upload_ids, ARRAY[]::uuid[]) AS upload_ids,
            html_id,
            schema_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM document_departments_junction
        WHERE document_departments_junction.document_id = (SELECT p.document_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.document_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link document to name
    link_document_name AS (
        INSERT INTO document_names_junction (document_id, name_id, created_at)
        SELECT 
            x.document_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT document_names_pkey DO NOTHING
    ),
    -- Link document to description
    link_document_description AS (
        INSERT INTO document_descriptions_junction (document_id, description_id, created_at)
        SELECT 
            x.document_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT document_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE document_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_document_active_flag AS (
        INSERT INTO document_flags_junction (document_id, flag_id, value, created_at) SELECT x.document_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'document_active'
        ON CONFLICT ON CONSTRAINT document_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, document_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Insert or UPDATE document_artifact template flag
    insert_document_template_flag AS (
        INSERT INTO document_flags_junction (document_id, flag_id, type, value, created_at)
        SELECT 
            x.document_id,
            COALESCE(x.template_flag_id, f.id),
            CASE WHEN x.template_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'template'
        ON CONFLICT ON CONSTRAINT document_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, document_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO document_departments_junction (document_id, department_id, active, created_at)
        SELECT 
            x.document_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT document_departments_pkey DO UPDATE SET
            active = true
    ),
    -- Link fields (old ones already deleted above if update)
    link_fields AS (
        INSERT INTO document_parameter_fields_junction (document_id, parameter_field_id, active, created_at)
        SELECT
            x.document_id,
            pfr.id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.field_ids) as field_resource_id
        JOIN parameter_fields_resource pfr ON pfr.field_id = field_resource_id
        WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
        ON CONFLICT (document_id, parameter_field_id) DO NOTHING
    ),
    -- Link parameters (derived from field -> parameter relationships)
    link_parameters AS (
        INSERT INTO document_parameters_junction (document_id, parameter_id, type, active, created_at)
        SELECT DISTINCT
            x.document_id,
            pfr.parameter_id,
            'direct'::link_type,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.field_ids) as field_resource_id
        JOIN parameter_fields_resource pfr ON pfr.field_id = field_resource_id
        WHERE COALESCE(array_length(x.field_ids, 1), 0) > 0
          AND pfr.parameter_id IS NOT NULL
        ON CONFLICT (document_id, parameter_id, type) DO UPDATE SET
            active = true
    ),
    -- Link view_uploads_entry (old ones already deleted above if update)
    link_uploads AS (
        INSERT INTO document_uploads_resource (document_id, uploads_id, active, created_at)
        SELECT 
            x.document_id,
            uploads_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.upload_ids) as uploads_id
        WHERE COALESCE(array_length(x.upload_ids, 1), 0) > 0
        ON CONFLICT (document_id, uploads_id) DO UPDATE SET
            active = true
    ),
    -- Update document_agent_domains if document_domain_id provided
    -- Domain-based agent assignment removed - no longer needed
    update_document_agent_domain AS (
        -- Placeholder CTE (removed domain logic)
        SELECT NULL::uuid as dummy FROM params LIMIT 0
    ),
    link_document_agent_domain AS (
        -- Placeholder CTE (removed domain logic)
        SELECT NULL::uuid as dummy FROM params LIMIT 0
    ),
    deactivate_previous_templates AS (
        -- Deactivate all previous templates if new one is provided
        UPDATE document_templates
        SET active = false, updated_at = NOW()
        WHERE document_id = (SELECT document_id FROM params)
          AND active = true
          AND (SELECT html_id FROM params) IS NOT NULL
    ),
    update_template_link AS (
        -- Update or insert template link (without html_id and schema_id)
        INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
        SELECT 
            p.document_id,
            ti.template_id,
            true,
            NOW(),
            NOW()
        FROM template_id ti
        CROSS JOIN params p
        WHERE p.html_id IS NOT NULL AND p.schema_id IS NOT NULL
        ON CONFLICT (document_id, template_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    update_html_link AS (
        -- Update or insert HTML link via document_html junction
        INSERT INTO document_html (document_id, html_id, active, created_at, updated_at)
        SELECT 
            p.document_id,
            p.html_id,
            true,
            NOW(),
            NOW()
        FROM params p
        WHERE p.html_id IS NOT NULL
        ON CONFLICT (document_id, html_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    update_schema_link AS (
        -- Update or insert schema link via document_schemas junction
        INSERT INTO document_schemas (document_id, schema_id, active, created_at, updated_at)
        SELECT 
            p.document_id,
            p.schema_id,
            true,
            NOW(),
            NOW()
        FROM params p
        WHERE p.schema_id IS NOT NULL
        ON CONFLICT (document_id, schema_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    delete_html_link AS (
        -- Deactivate HTML link if html_id is NULL (removing template)
        UPDATE document_html 
        SET active = false, updated_at = NOW()
        WHERE document_id = (SELECT document_id FROM params)
        AND (SELECT html_id FROM params) IS NULL
    ),
    delete_schema_link AS (
        -- Deactivate schema link if schema_id is NULL (removing template)
        UPDATE document_schemas 
        SET active = false, updated_at = NOW()
        WHERE document_id = (SELECT document_id FROM params)
        AND (SELECT schema_id FROM params) IS NULL
    ),
    delete_template_link AS (
        -- Delete template link if html_id is NULL (removing template)
        DELETE FROM document_templates
        WHERE document_id = (SELECT document_id FROM params)
        AND (SELECT html_id FROM params) IS NULL
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE documents_resource r
        SET name = n.name,
            description = d.description
        FROM document_documents_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.documents_id = r.id
          AND j.document_id = p.document_id
        RETURNING r.id
    )
    SELECT
        x.document_id AS document_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
