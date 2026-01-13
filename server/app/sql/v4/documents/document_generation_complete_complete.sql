-- Document generation complete event handler
-- Comprehensive function that orchestrates entire completion flow:
-- 1. Creates upload record for template HTML file
-- 2. Creates schema from template_schema_json (handles nested arrays)
-- 3. Creates template and links to document/run
-- 4. Fetches template mapping
-- 5. Returns complete client payload structure
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
        WHERE proname = 'socket_document_generation_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_generation_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_document_generation_complete_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
-- Note: template_html and template_schema_json are extracted from tool_call_arguments in the function body
-- file_path and file_size are computed in Python handler and passed in
CREATE OR REPLACE FUNCTION socket_document_generation_complete_v4(
    profile_id uuid,
    run_id uuid,
    file_path text,
    file_size bigint,
    template_html text,
    template_schema_json text,
    document_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    department_id uuid DEFAULT NULL,
    document_name text DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    result_document_id uuid,
    result_template_html text,
    template_schema jsonb,
    upload_id uuid,
    template_mapping jsonb,
    trace_id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    upload_id_val uuid;
    html_id_val uuid;
    schema_id_val uuid;
    template_id_val uuid;
    template_mapping_val jsonb;
    trace_id_val text;
BEGIN
    -- Get trace_id from groups table if group_id provided
    IF group_id IS NOT NULL THEN
        SELECT trace_id INTO trace_id_val FROM groups WHERE id = group_id LIMIT 1;
    END IF;

    -- 1. Create upload record for template HTML file
    INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
    VALUES (file_path, 'text/html', file_size, NOW(), NOW())
    RETURNING id INTO upload_id_val;

    -- 1a. Create html entry (strong entity)
    INSERT INTO html_resource (name, created_at, updated_at, active, completed)
    VALUES (
        COALESCE('Template HTML: ' || document_name, 'Template HTML'),
        NOW(),
        NOW(),
        true,
        false
    )
    RETURNING id INTO html_id_val;

    -- 1b. Link html to upload via html_uploads junction
    INSERT INTO html_uploads (html_id, upload_id, active, created_at, updated_at)
    VALUES (html_id_val, upload_id_val, true, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    -- 2. Create schema from template_schema_json
    -- Parse JSON and create schema_fields (handles nested arrays recursively)
    IF template_schema_json IS NOT NULL AND template_schema_json != '{}' THEN
        -- Create schema record
        schema_id_val := gen_random_uuid();
        INSERT INTO schemas_resource (id, created_at, updated_at)
        VALUES (schema_id_val, NOW(), NOW());

        -- Create schema_fields from JSON
        -- Use a recursive CTE to handle nested arrays
        WITH RECURSIVE field_processor AS (
            -- Base case: process top-level fields
            SELECT 
                (field->>'name')::text as field_name,
                (field->>'type')::text as field_type,
                COALESCE((field->>'required')::boolean, false) as required,
                (field->>'description')::text as description,
                (field->>'placeholder')::text as placeholder,
                field->'item' as item_schema,
                0 as position,
                gen_random_uuid() as field_id,
                schema_id_val as parent_schema_id,
                NULL::uuid as parent_field_id
            FROM jsonb_array_elements(template_schema_json::jsonb->'fields') as field
            WHERE template_schema_json::jsonb ? 'fields'
        ),
        create_fields AS (
            -- Insert top-level fields
            INSERT INTO schema_fields_resource (
                id, schema_id, name, field_type, required, position, description, placeholder,
                created_at, updated_at
            )
            SELECT 
                field_id,
                parent_schema_id,
                field_name,
                CASE field_type
                    WHEN 'string' THEN 'string'::schema_field_type
                    WHEN 'number' THEN 'number'::schema_field_type
                    WHEN 'boolean' THEN 'boolean'::schema_field_type
                    WHEN 'array' THEN 'array'::schema_field_type
                    ELSE 'string'::schema_field_type
                END,
                required,
                position,
                description,
                placeholder,
                NOW(),
                NOW()
            FROM field_processor
            WHERE item_schema IS NULL OR jsonb_typeof(item_schema) != 'object'
            RETURNING id, schema_id, name
        ),
        process_array_items AS (
            -- For array fields, create item schemas recursively
            SELECT 
                fp.field_id as parent_field_id,
                (item_field->>'name')::text as item_field_name,
                (item_field->>'type')::text as item_field_type,
                COALESCE((item_field->>'required')::boolean, false) as item_required,
                (item_field->>'description')::text as item_description,
                (item_field->>'placeholder')::text as item_placeholder,
                gen_random_uuid() as item_schema_id,
                gen_random_uuid() as item_field_id,
                ROW_NUMBER() OVER (PARTITION BY fp.field_id ORDER BY 1) - 1 as item_position
            FROM field_processor fp
            CROSS JOIN jsonb_array_elements(fp.item_schema->'fields') as item_field
            WHERE fp.field_type = 'array' 
              AND fp.item_schema IS NOT NULL
              AND jsonb_typeof(fp.item_schema) = 'object'
              AND fp.item_schema ? 'fields'
        ),
        create_item_schemas AS (
            -- Create item schemas for array fields
            INSERT INTO schemas_resource (id, created_at, updated_at)
            SELECT DISTINCT item_schema_id, NOW(), NOW()
            FROM process_array_items
            RETURNING id
        ),
        create_item_fields AS (
            -- Create fields for item schemas
            INSERT INTO schema_fields_resource (
                id, schema_id, name, field_type, required, position, description, placeholder,
                created_at, updated_at
            )
            SELECT 
                pai.item_field_id,
                pai.item_schema_id,
                pai.item_field_name,
                CASE pai.item_field_type
                    WHEN 'string' THEN 'string'::schema_field_type
                    WHEN 'number' THEN 'number'::schema_field_type
                    WHEN 'boolean' THEN 'boolean'::schema_field_type
                    WHEN 'array' THEN 'array'::schema_field_type
                    ELSE 'string'::schema_field_type
                END,
                pai.item_required,
                pai.item_position,
                pai.item_description,
                pai.item_placeholder,
                NOW(),
                NOW()
            FROM process_array_items pai
            RETURNING id, schema_id
        ),
        link_array_items AS (
            -- Link array fields to their item schemas
            INSERT INTO schema_field_items_resource (
                schema_field_id, item_schema_id, created_at, updated_at
            )
            SELECT DISTINCT
                pai.parent_field_id,
                pai.item_schema_id,
                NOW(),
                NOW()
            FROM process_array_items pai
            RETURNING schema_field_id, item_schema_id
        )
        SELECT 1; -- Dummy select to complete CTE
    END IF;

    -- 3. Create template and link to document/run (only if document_id provided)
    IF document_id IS NOT NULL THEN
        -- Deactivate previous templates
        UPDATE document_templates
        SET active = false, updated_at = NOW()
        WHERE document_templates.document_id = document_id
          AND document_templates.active = true;

        -- Create template (just values, no schema/HTML refs)
        INSERT INTO templates_resource (name, created_at, updated_at)
        VALUES (
            COALESCE('Template for ' || document_name, 'Template for Document'),
            NOW(),
            NOW()
        )
        RETURNING id INTO template_id_val;

        -- Link template to schema via schema_templates junction
        IF schema_id_val IS NOT NULL THEN
            INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
            VALUES (schema_id_val, template_id_val, NOW(), NOW())
            ON CONFLICT (schema_id, template_id) DO UPDATE SET updated_at = NOW();
        END IF;

        -- Link template to document (without html_id and schema_id)
        INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
        VALUES (document_id, template_id_val, true, NOW(), NOW())
        ON CONFLICT (document_id, template_id) DO UPDATE SET
            active = EXCLUDED.active,
            updated_at = NOW();

        -- Link HTML to document via document_html junction
        IF html_id_val IS NOT NULL THEN
            INSERT INTO document_html (document_id, html_id, active, created_at, updated_at)
            VALUES (document_id, html_id_val, true, NOW(), NOW())
            ON CONFLICT (document_id, html_id) DO UPDATE SET
                active = EXCLUDED.active,
                updated_at = NOW();
        END IF;

        -- Link schema to document via document_schemas junction
        IF schema_id_val IS NOT NULL THEN
            INSERT INTO document_schemas (document_id, schema_id, active, created_at, updated_at)
            VALUES (document_id, schema_id_val, true, NOW(), NOW())
            ON CONFLICT (document_id, schema_id) DO UPDATE SET
                active = EXCLUDED.active,
                updated_at = NOW();
        END IF;

        -- 4. Fetch template mapping
        SELECT jsonb_object_agg(
            dh.html_id::text,
            jsonb_build_object(
                'template_id', dt.template_id::text,
                'schema_id', ds.schema_id::text,
                'html_id', dh.html_id::text,
                'active', dt.active,
                'created_at', dt.created_at,
                'updated_at', dt.updated_at
            )
        )
        INTO template_mapping_val
        FROM document_templates dt
        LEFT JOIN document_html dh ON dh.document_id = dt.document_id AND dh.active = dt.active
        LEFT JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.active = dt.active
        WHERE dt.document_id = document_id;
    END IF;

    -- 5. Return complete client payload structure
    RETURN QUERY
    SELECT 
        true as success,
        'Document template created successfully' as message,
        document_id as result_document_id,
        template_html as result_template_html,
        template_schema_json::jsonb as template_schema,
        upload_id_val as upload_id,
        COALESCE(template_mapping_val, '{}'::jsonb) as template_mapping,
        trace_id_val as trace_id;
END;
$$;

