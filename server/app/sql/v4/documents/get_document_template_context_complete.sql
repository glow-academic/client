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
        ((SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), 
         COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), ''), 
         (SELECT n2.name FROM parameter_names pn JOIN names n2 ON pn.name_id = n2.id WHERE pn.parameter_id = pa.id LIMIT 1), 
         COALESCE((SELECT d2.description FROM parameter_descriptions pd JOIN descriptions d2 ON pd.description_id = d2.id WHERE pd.parameter_id = pa.id LIMIT 1), ''))::types.q_get_document_template_context_v4_field
        ORDER BY array_position($1, f.id)
    ),
    '{}'::types.q_get_document_template_context_v4_field[]
) as fields
FROM field f
JOIN parameter_fields pf ON pf.field_id = f.id
JOIN parameters pa ON pa.id = pf.parameter_id AND EXISTS (SELECT 1 FROM parameter_flags paf JOIN flags fl ON paf.flag_id = fl.id WHERE paf.parameter_id = pa.id AND fl.name = 'active' AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE)
WHERE f.id = ANY($1)
$$;