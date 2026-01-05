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
-- Note: schema_id and html_id are provided by Python code
CREATE OR REPLACE FUNCTION socket_create_template_and_link_v4(
    document_id uuid,
    html_id uuid,
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
    -- Check if template already exists (same html_id and schema_id via document_html and document_schemas)
    SELECT DISTINCT dt.template_id
    FROM document_templates dt
    JOIN document_html dh ON dh.document_id = dt.document_id AND dh.html_id = $2 AND dh.active = true
    JOIN document_schemas ds ON ds.document_id = dt.document_id AND ds.schema_id = $4 AND ds.active = true
    WHERE dt.active = true
    LIMIT 1
),
create_template AS (
    -- Create template (just values, no schema/HTML refs)
    INSERT INTO templates (name, created_at, updated_at)
    SELECT 
        $3,
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
    -- Link template to schema via schema_templates junction table
    INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
    SELECT 
        $4,
        ti.template_id,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE $4 IS NOT NULL
    ON CONFLICT (schema_id, template_id) DO UPDATE SET
        updated_at = NOW()
),
link_to_document AS (
    -- Link template to document (without html_id and schema_id)
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
link_html_to_document AS (
    -- Link HTML to document via document_html junction
    INSERT INTO document_html (document_id, html_id, active, created_at, updated_at)
    SELECT 
        $1,
        $2,
        $5,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE $2 IS NOT NULL
    ON CONFLICT (document_id, html_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
link_schema_to_document AS (
    -- Link schema to document via document_schemas junction
    INSERT INTO document_schemas (document_id, schema_id, active, created_at, updated_at)
    SELECT 
        $1,
        $4,
        $5,
        NOW(),
        NOW()
    FROM template_id ti
    WHERE $4 IS NOT NULL
    ON CONFLICT (document_id, schema_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
),
link_to_run AS (
    -- Link template to run via tool_call if run_id provided
    -- Note: This assumes templates have tool_call_id set (via calls)
    -- The run relationship is derived via templates → tool_call → tool_call_runs → run
    -- This CTE verifies the relationship exists but no longer inserts into template_runs
    SELECT 
        ltd.template_id
    FROM link_to_document ltd
    WHERE $6 IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM templates t
        JOIN calls tc ON tc.id = t.tool_call_id
        JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
        WHERE t.id = ltd.template_id
        AND tcr.run_id = $6
    )
)
SELECT template_id FROM link_to_document LIMIT 1
$$;