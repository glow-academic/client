-- Create template and link to document and run
-- Converted to PostgreSQL function pattern
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
        WHERE proname = 'socket_create_template_and_link_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_template_and_link_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_create_template_and_link_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
-- Note: schema_id is provided by Python code which creates schema records first
CREATE OR REPLACE FUNCTION socket_create_template_and_link_v4(
    document_id uuid,
    upload_id uuid,
    name text,
    schema_id uuid,
    active boolean,
    run_id uuid
)
RETURNS TABLE (
    template_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH deactivate_previous AS (
    -- Mark all previous templates as inactive if new one is active
    UPDATE document_templates
    SET active = false, updated_at = NOW()
    WHERE document_templates.document_id = $1
      AND document_templates.active = true
      AND $5 = true
),
existing_template AS (
    -- Check if template already exists (same upload_id and schema_id)
    SELECT templates.id as template_id
    FROM templates
    JOIN template_schemas ts ON ts.template_id = templates.id
    WHERE templates.upload_id = $2 
      AND ts.schema_id = $4
    LIMIT 1
),
create_template AS (
    -- Create template if it doesn't exist (still store args JSONB for backward compatibility during migration)
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        $3,
        $2,
        '{}'::jsonb,  -- Empty args, schema is stored separately
        NOW(),
        NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_template)
    RETURNING templates.id as template_id
),
template_id AS (
    SELECT template_id FROM existing_template
    UNION ALL
    SELECT template_id FROM create_template
    LIMIT 1
),
link_schema AS (
    -- Link template to schema via template_schemas junction table
    INSERT INTO template_schemas (template_id, schema_id, created_at, updated_at)
    SELECT 
        ti.template_id,
        $4,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE $4 IS NOT NULL
    ON CONFLICT (template_id, schema_id) DO UPDATE SET
        updated_at = NOW()
),
link_to_document AS (
    -- Link template to document
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        $1,
        ti.template_id,
        $5,
        NOW(),
        NOW()
    FROM template_id ti
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING template_id
),
link_to_run AS (
    -- Link template to run via tool_call if run_id provided
    -- Note: This assumes templates have tool_call_id set (via tool_calls)
    -- The run relationship is derived via templates → tool_call → tool_call_runs → run
    -- This CTE verifies the relationship exists but no longer inserts into template_runs
    SELECT 
        ltd.template_id
    FROM link_to_document ltd
    WHERE $6 IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM templates t
        JOIN tool_calls tc ON tc.id = t.tool_call_id
        JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
        WHERE t.id = ltd.template_id
        AND tcr.run_id = $6
    )
)
SELECT template_id FROM link_to_document LIMIT 1
$$;