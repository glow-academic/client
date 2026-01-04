-- Get fields information for document template generation context
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
        WHERE proname = 'socket_get_document_template_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_document_template_context_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_document_template_context_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_document_template_context_v4_field AS (
    item_name text,
    item_description text,
    param_name text,
    param_description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_document_template_context_v4(
    field_ids uuid[]
)
RETURNS TABLE (
    fields types.q_get_document_template_context_v4_field[]
)
LANGUAGE sql
VOLATILE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (f.name, COALESCE(f.description, ''), pa.name, COALESCE(pa.description, ''))::types.q_get_document_template_context_v4_field
        ORDER BY array_position($1, f.id)
    ),
    '{}'::types.q_get_document_template_context_v4_field[]
) as fields
FROM fields f
JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
JOIN parameters pa ON pa.id = fp.parameter_id
WHERE f.id = ANY($1)
  AND pa.active = true
$$;