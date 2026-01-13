-- Create template value (handles string, number, boolean)
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'utils_create_template_value_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_create_template_value_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION utils_create_template_value_v4(
    template_id uuid,
    schema_field_id uuid,
    string_value text DEFAULT NULL,
    number_value numeric DEFAULT NULL,
    boolean_value boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
    INSERT INTO template_values_resource (
        template_id, schema_field_id, string_value, number_value, boolean_value, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (template_id, schema_field_id) DO UPDATE SET
        string_value = EXCLUDED.string_value,
        number_value = EXCLUDED.number_value,
        boolean_value = EXCLUDED.boolean_value,
        updated_at = NOW();
END;
$$;
