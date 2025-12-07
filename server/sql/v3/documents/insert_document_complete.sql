-- Insert document with department, parameter item, and upload links in single transaction
-- Parameters: 
--   $1 = document_id (uuid)
--   $2 = name (text)
--   $3 = description (text, nullable)
--   $4 = upload_id (uuid, nullable - for regular documents)
--   $5 = department_ids (uuid[])
--   $6 = field_ids (uuid[])
--   $7 = template_upload_id (uuid, nullable - for template HTML)
--   $8 = template_args (jsonb, nullable - template schema)
--   $9 = parameter_ids (text array, nullable)
-- Returns: document_id (text)

WITH insert_doc AS (
    INSERT INTO documents (
        id, 
        name,
        description,
        active,
        template,
        created_at, 
        updated_at,
        classify_agent_id,
        document_agent_id
    )
    VALUES (
        $1, 
        $2,
        COALESCE($3, ''),
        true,
        false,  -- template defaults to false - must be explicitly enabled via update
        NOW(), 
        NOW(),
        (SELECT id FROM agents WHERE role = 'classify' AND active = true LIMIT 1),
        (SELECT id FROM agents WHERE role = 'document' AND active = true LIMIT 1)
    )
    RETURNING id
),
insert_upload AS (
    -- Link regular upload if provided
    INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
    SELECT $1, $4::uuid, true, NOW(), NOW()
    WHERE $4::uuid IS NOT NULL
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
create_or_get_template AS (
    -- Create or get template if template_upload_id is provided
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        $2 as name,
        $7::uuid,
        COALESCE($8::jsonb, '{}'::jsonb),
        NOW(),
        NOW()
    WHERE $7::uuid IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM templates t 
          WHERE t.upload_id = $7::uuid AND t.args = COALESCE($8::jsonb, '{}'::jsonb)
      )
    RETURNING id as template_id
),
get_existing_template AS (
    -- Get existing template if it exists
    SELECT id as template_id
    FROM templates
    WHERE upload_id = $7::uuid 
      AND args = COALESCE($8::jsonb, '{}'::jsonb)
    LIMIT 1
),
template_id AS (
    SELECT template_id FROM create_or_get_template
    UNION ALL
    SELECT template_id FROM get_existing_template
    WHERE $7::uuid IS NOT NULL
    LIMIT 1
),
insert_template_link AS (
    -- Link template to document if template_id is available
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        $1,
        ti.template_id,
        true,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE $7::uuid IS NOT NULL
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
insert_depts AS (
    INSERT INTO document_departments (document_id, department_id, active, created_at, updated_at)
    SELECT $1, dept_id, true, NOW(), NOW()
    FROM unnest($5::uuid[]) as dept_id
    WHERE cardinality($5::uuid[]) > 0
    RETURNING document_id
),
insert_fields AS (
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT $1, field_id, true, NOW(), NOW()
    FROM unnest($6::uuid[]) as field_id
    WHERE cardinality($6::uuid[]) > 0
    RETURNING document_id
),
link_parameters AS (
    -- Link parameters if provided (array is never NULL, but may be empty)
    INSERT INTO parameter_documents (parameter_id, document_id, active, created_at, updated_at)
    SELECT 
        param_id::uuid,
        $1,
        true,
        NOW(),
        NOW()
    FROM UNNEST($9::text[]) as param_id
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
    ON CONFLICT (parameter_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
backfill_document_fields AS (
    -- Backfill document_fields for linked parameters (pick first field if none exists)
    INSERT INTO document_fields (document_id, field_id, active, created_at, updated_at)
    SELECT DISTINCT
        pd.document_id,
        fp.field_id,
        TRUE,
        NOW(),
        NOW()
    FROM parameter_documents pd
    JOIN field_parameters fp ON fp.parameter_id = pd.parameter_id AND fp.active = TRUE
    WHERE pd.document_id = $1
    AND pd.active = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM document_fields df
        WHERE df.document_id = pd.document_id
        AND df.field_id = fp.field_id
        AND df.active = TRUE
    )
    AND fp.field_id = (
        SELECT fp2.field_id
        FROM field_parameters fp2
        WHERE fp2.parameter_id = pd.parameter_id
        AND fp2.active = TRUE
        ORDER BY fp2.created_at ASC
        LIMIT 1
    )
    ON CONFLICT (document_id, field_id) DO UPDATE SET
        active = TRUE,
        updated_at = NOW()
)
SELECT $1::text as document_id
