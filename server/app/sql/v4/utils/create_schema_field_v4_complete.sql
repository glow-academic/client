-- Create schema field
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_schema_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_schema_field_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION utils_create_schema_field_v4(
    field_id uuid,
    schema_id uuid,
    name text,
    field_type text,
    required boolean,
    position_value integer,
    description text DEFAULT NULL,
    placeholder text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO schema_fields (
        id, schema_id, name, field_type, required, "position", description,
        created_at, updated_at
    )
    VALUES ($1, $2, $3, $4::schema_field_type, $5, $6, $7, NOW(), NOW())
$$;
