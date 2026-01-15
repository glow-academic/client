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
    -- Mark all previous args_outputs as inactive if new one is active (via args_outputs_resource.active)
    UPDATE args_outputs_resource ao
    SET active = false, updated_at = NOW()
    FROM document_args_outputs dao
    WHERE dao.document_id = $1
      AND dao.args_outputs_id = ao.id
      AND ao.active = true
      AND $5 = true
),
existing_template AS (
    -- Check if args_outputs_resource already exists (same name and args_id via document_args_outputs and document_args)
    SELECT DISTINCT dao.args_outputs_id as template_id
    FROM document_args_outputs dao
    JOIN args_outputs_resource ao ON ao.id = dao.args_outputs_id AND ao.active = true
    JOIN document_html dh ON dh.document_id = dao.document_id AND dh.html_id = $2 AND dh.active = true
    JOIN document_args da ON da.document_id = dao.document_id AND da.args_id = $4
    WHERE ao.name = $3 AND ao.args_id = $4
    LIMIT 1
),
dummy_call AS (
    -- Create dummy call if run_id not provided (call_id is required for args_outputs_resource)
    -- Note: calls requires tool_id and template_id (both NOT NULL)
    INSERT INTO calls (id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        uuidv7(),
        'create_template_and_link_' || gen_random_uuid()::text,
        COALESCE(
            (SELECT id FROM tool_artifact LIMIT 1),
            (SELECT tool_id FROM calls LIMIT 1)
        ),  -- Get any tool_id for dummy call
        COALESCE(
            (SELECT id FROM args_outputs_resource LIMIT 1),
            (SELECT template_id FROM calls LIMIT 1)
        ),  -- Get any template_id for dummy call
        '{}',
        true,
        NOW(),
        NOW()
    WHERE $6 IS NULL
      AND NOT EXISTS (SELECT 1 FROM calls WHERE external_call_id LIKE 'create_template_and_link_%' LIMIT 1)
    ON CONFLICT DO NOTHING
    RETURNING id as call_id
),
get_call_id AS (
    -- Get call_id from run if provided, otherwise use dummy call or existing
    SELECT COALESCE(
        (SELECT c.id FROM calls c JOIN message_runs mr ON mr.run_id = $6 JOIN message_calls mc ON mc.message_id = mr.message_id WHERE mc.call_id = c.id LIMIT 1),
        (SELECT call_id FROM dummy_call),
        (SELECT id FROM calls WHERE external_call_id LIKE 'create_template_and_link_%' LIMIT 1),
        (SELECT id FROM calls LIMIT 1)  -- Fallback to any call
    ) as call_id
),
create_template AS (
    -- Create args_outputs_resource (with name and args_id linking to schema)
    INSERT INTO args_outputs_resource (id, name, template, args_id, active, generated, mcp, call_id, created_at, updated_at)
    SELECT 
        uuidv7(),
        $3,
        '',  -- template field - can be empty initially
        $4,  -- args_id links to the schema (args_resource.id)
        $5,
        true,
        false,
        (SELECT call_id FROM get_call_id),
        NOW(),
        NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_template)
      AND $4 IS NOT NULL  -- schema_id (args_resource.id) must be provided
    RETURNING id as template_id
),
template_id AS (
    SELECT template_id FROM existing_template
    UNION ALL
    SELECT template_id FROM create_template
    LIMIT 1
),
link_to_document AS (
    -- Link args_outputs_resource to document via document_args_outputs
    INSERT INTO document_args_outputs (document_id, args_outputs_id, created_at, updated_at, generated, mcp)
    SELECT 
        $1,
        ti.template_id,
        NOW(),
        NOW(),
        true,
        false
    FROM template_id ti
    WHERE ti.template_id IS NOT NULL
    ON CONFLICT (document_id, args_outputs_id) DO UPDATE SET
        updated_at = NOW()
    RETURNING args_outputs_id as template_id
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
    -- Link args_resource (schema) to document via document_args junction
    INSERT INTO document_args (document_id, args_id, created_at, updated_at, generated, mcp)
    SELECT 
        $1,
        $4,  -- schema_id is actually args_resource.id
        NOW(),
        NOW(),
        true,
        false
    FROM template_id ti
    WHERE $4 IS NOT NULL
    ON CONFLICT (document_id, args_id) DO UPDATE SET
        updated_at = NOW()
),
link_to_run AS (
    -- Link template to run via tool_call if run_id provided
    -- Note: Templates no longer have tool_call_id, so we can't verify the run relationship
    -- This CTE is kept for compatibility but doesn't perform verification
    SELECT 
        ltd.template_id
    FROM link_to_document ltd
    WHERE $6 IS NOT NULL
)
SELECT template_id FROM link_to_document LIMIT 1
$$;